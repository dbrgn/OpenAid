/*** Configuration variables ***/

var width = 960;
var heights = {
    step1: 800,
    step2: 800,
    step3: 800,
    step4: 800,
    step5: 800,
    total: 4000
};
var margins = {
    step1: {top: 100, bottom: 0, left: 60, right: 60},
    step2: {top: 0, bottom: 0, left: 0, right: 0},
    step3: {top: 0, bottom: 0, left: 0, right: 0},
    step4: {top: 0, bottom: 0, left: 0, right: 0},
    step5: {top: 0, bottom: 0, left: 0, right: 0}
}


/*** D3/SVG setup ***/

var projection = d3.geo.albers()
    .rotate([0, 0])
    .center([8.43, 46.8])
    .scale(13600);

var bubble_area = d3.scale.linear()
    .range([20, 180 * 180 * Math.PI]);

var bubble_radius = function(value) {
    return Math.sqrt(bubble_area(value) / Math.PI);
}
 
var path = d3.geo.path()
    .projection(projection);

var step_1_2_nodes = [], step_1_2_links = [],
    step_2_3_nodes = [], step_2_3_links = [],
    step_3_4_nodes = [], step_3_4_links = [];

var svg = d3.select("#svg").append("svg")
    .attr("width", width)
    .attr("height", heights.total);


/*** Helper functions ***/

function is_node(d) {
    return d.hasOwnProperty("x") && d.hasOwnProperty("y");
}

function is_link(d) {
    return d.hasOwnProperty("source") && d.hasOwnProperty("target");
}

function get_real_position(obj) {
    // Get original position
    var x = +obj.getAttribute("cx"),
        y = +obj.getAttribute("cy");

    // Get offset
    var matrix = obj.getCTM(),
        x_offset = matrix.e,
        y_offset = matrix.f;

    // Return real position
    return {x: x + x_offset, y: y + y_offset};
}

function money_format(amount) {
    if (amount > 1e9) {
        return (Math.round(amount / 1e8) / 10) + " Mrd";
    } else if (amount > 1e6) {
        return (Math.round(amount / 1e5) / 10) + " Mio";
    } else if (amount > 1e3) {
        return (Math.round(amount / 1e2) / 10) + " Tsd";
    }
    return amount;
}

function condense_ngo_top10(ngo_detailed_data) {
   var ngo_details_sorted = ngo_detailed_data.slice(0); // Clone the original array to leave it untouched by resort.
   ngo_details_sorted.sort(ngo_by_amount_desc);
   var result = new Array(11);
    var otherMoney = 0;
    ngo_details_sorted.forEach(function(e, i) {
        if (i < 10) {
            result[i] = {label: [e.organization], amount: (Number(e.money))};
        } else {
        	// Not within the top10, add to "rest".
        	otherMoney += Number(e.money);
        }
    });
    result[10] =  {label: ["andere"], amount: (otherMoney)};
    return result;
}
/*
 * Comparator for two ngo records. Sorts by amount descending. 
 */
function ngo_by_amount_desc(ngo1, ngo2) {
    return Number(ngo2.money) - Number(ngo1.money);
}

/*** Load and process data ***/

queue()
    .defer(d3.json, "geodata/switzerland.topojson")
    .defer(d3.json, "geodata/switzerland.geojson")
    .defer(d3.json, "geodata/world.topojson")
    .defer(d3.tsv, "cleaned_data/statistiken_2011.kantone.tsv") 
    .defer(d3.tsv, "cleaned_data/statistiken_2011.alles.tsv") 
    .defer(d3.csv, "cleaned_data/deza_auftragsstatistik_2010_agg.csv")
    .await(ready);
 
function ready(error, topology, canton_shapes, world_topo, canton_data, summary_data, ngo_data) {

    var money_items_2010 = d3.nest().key(function(e) { return e.year; }).map(summary_data)["2010"];
    var total_money_2010 = d3.sum(money_items_2010.map(function(e) { return +e.money; }));
    // condense ngo data to top ngo data
    var ngo_top = condense_ngo_top10(ngo_data);
    
    bubble_area.domain([0, total_money_2010 / 1000]);

    var svg_background = svg.append("svg:g");
    var svg_lines = svg.append("svg:g");
    var svg_bubbles = svg.append("svg:g");
    var svg_labels = svg.append("svg:g");
    
    /*** Step 1: Cantons ***/

    (function(step1, undefined) { // Step 1 {{{

        /*** Switzerland ***/

        svg_background.append("path")
            .datum(topojson.object(topology, topology.objects["swiss-cantons"]))
            .attr("d", path)
            .attr("class", "cantons area-region");

        /*svg.append("path")
            .datum(topojson.mesh(topology, topology.objects["swiss-municipalities"], function(a, b) { return a.properties.bfsNo !== b.properties.bfsNo }))
            .attr("d", path)
            .attr("class", "municipality-boundary");*/

        svg_background.append("path")
            .datum(topojson.mesh(topology, topology.objects["swiss-cantons"], function(a, b) { return a.properties.no !== b.properties.no}))
            .attr("d", path)
            .attr("class", "canton-boundary");

        svg_background.append("path")
            .datum(topojson.mesh(topology, topology.objects["swiss-cantons"], function(a, b) { return a.properties.no === b.properties.no; }))
            .attr("d", path)
            .attr("class", "land-boundary");

   
        /*** Dorling Cartogram ***/

        var idToNode = {};
        var links = [];

        var canton_data_map = d3.nest()
            .key(function(e) { return e.abbrev; })
            .map(canton_data);

        var nodes = canton_shapes.features.map(function(d, i) {
            var xy = projection(d3.geo.centroid(d));
            var value = +canton_data_map[d.properties.abbr][0].total_2010;
            return idToNode[d.id] = {
                id: 100 + i,
                x: +xy[0],
                y: +xy[1],
                gravity: {x: xy[0], y: xy[1]},
                r: bubble_radius(value),
                value: value
            };
        });
        step_1_2_nodes = step_1_2_nodes.concat(nodes);

        d3.layout.force()
            .charge(0)
            .gravity(0)
            .size([width, heights.step1])
            .nodes(nodes)
            .links(links)
            .start()
            .on("tick", function(e) {
                var k = e.alpha,
                    kg = k * .02;
                nodes.forEach(function(a, i) {
                    // Apply gravity forces
                    a.x += (a.gravity.x - a.x) * kg;
                    a.y += (a.gravity.y - a.y) * kg;
                    nodes.slice(i + 1).forEach(function(b) {
                        // Check for collisions
                        var dx = a.x - b.x,
                            dy = a.y - b.y,
                            l = Math.sqrt(dx * dx + dy * dy),
                            d = a.r + b.r;
                        if (l < d) {
                            l = (l - d) / l * k;
                            dx *= l;
                            dy *= l;
                            a.x -= dx;
                            a.y -= dy;
                            b.x += dx;
                            b.y += dy;
                        }
                    });
                });

                svg_bubbles.selectAll("circle.cantonbubble")
                    .attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; });
            });

        svg_bubbles.selectAll("circle.cantonbubble")
            .data(nodes)
          .enter()
            .append("circle")
            .attr("class", "cantonbubble bubble")
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", function (d) { return d.r; });

    }(window.step1 = window.step1 || {})); // }}}

    /*** Step 2: Confederation, Cantons and private ***/

    (function(step2, undefined) { // Step 2 {{{

        // Prepare data
        var summary_data_map = d3.nest()
            .key(function(e) { return e.year; })
            .key(function(e) { return e.type; })
            .key(function(e) { return e.level; })
            .map(summary_data);
        var data = [
            {
                label: ["Bund"],
                amount:
                    (+summary_data_map["2010"]["développement"]["Confédération"][0].money) +
                    (+summary_data_map["2010"]["sudest"]["Confédération"][0].money)
            }, {
                label: ["Kantone &", "Gemeinden"],
                amount:
                    (+summary_data_map["2010"]["développement"]["Cantons"][0].money) +
                    (+summary_data_map["2010"]["sudest"]["Cantons"][0].money) +
                    (+summary_data_map["2010"]["développement"]["Communes"][0].money) +
                    (+summary_data_map["2010"]["sudest"]["Communes"][0].money)
            }, {
                label: ["Private", "Spenden"],
                amount:
                    (+summary_data_map["2010"]["développement"]["ONG"][0].money) +
                    (+summary_data_map["2010"]["sudest"]["ONG"][0].money)
            }
        ];

        // Compute location of step 2 bubbles
        var step2bubble_xpos = function(d, i) {
            var base = (i + 1) * 2 * (width / 6) - (width / 6);
            if (i == 0) {
                return base + 50;
            } else if (i == 2) {
                return base - 50;
            }
            return base;
        }
        var step2bubble_ypos = function(d, i) {
            var base = heights.step1 + margins.step2.top;
            if (i == 0 || i == 2) {
                return base + 250;
            }
            return base;
        }
        // Add step 2 bubbles
        svg_bubbles.selectAll("circle.step2bubble")
            .data(data)
          .enter()
            .append("circle")
            .attr("class", "step2bubble bubble")
            .attr("cx", step2bubble_xpos)
            .attr("cy", step2bubble_ypos)
            .attr("r", function(d) { return bubble_radius(d.amount / 1000); });

        // Add labels
        svg_labels.selectAll("g.step2.label")
            .data(data)
          .enter()
            .append("g.step2.label");
        svg_labels.selectAll("g.step2.label")
            .data(data)
          .enter()
            .append("text")
            .attr("x", step2bubble_xpos)
            .attr("y", step2bubble_ypos)
            .text(function(d) { return d.label[0]; })
            .attr("font-family", "Museo-slab")
            .attr("font-size", "25px")
            .attr("text-anchor", "middle")
            .attr("fill", "#888280")
            .attr("transform", "translate(0,-10)");
        svg_labels.selectAll("g.step2.label")
            .data(data)
          .enter()
            .append("text")
            .attr("x", step2bubble_xpos)
            .attr("y", step2bubble_ypos)
            .text(function(d) { return money_format(d.amount); })
            .attr("font-family", "Museo-slab")
            .attr("font-size", "25px")
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("transform", "translate(0,14)");

        // Add the three "aggregation bubbles" to the global node list
        svg_bubbles.selectAll("circle.step2bubble")[0].forEach(function(e, i) {
            var pos = get_real_position(e);
            step_1_2_nodes.push({
                id: 200 + i,
                x: pos.x,
                y: pos.y,
            });
            step_2_3_nodes.push({
                id: 200 + i,
                x: pos.x,
                y: pos.y,
            });
        });

        // Link all canton nodes to the second aggregation bubble
        var canton_aggregation_bubble = step_1_2_nodes.filter(function(d) { return d.id == 201; })[0];
        step_1_2_nodes.filter(function(d) { return d.id < 200; }).forEach(function(d) {
            step_1_2_links.push({
                source: d,
                target: canton_aggregation_bubble,
                value: 1
            });
        });

        // Draw links as bézier curves
        svg_lines.selectAll(".link.step1.step2")
            .data(step_1_2_links)
          .enter().append("path")
            .attr("class", "link step1 step2")
            .attr("d", function(d) {
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy);
                return "M" + d.source.x + "," + d.source.y + // Start point
                       "C" + d.source.x + "," + (d.source.y + (Math.abs(dx) / 2)) + // First control point
                       " " + d.target.x + "," + (d.target.y - (Math.abs(dx) / 2)) + // Second control point
                       " " + d.target.x + "," + d.target.y; // Target point
            })
          .append("text")
              .text("Bund");


    }(window.step2 = window.step2 || {})); // }}}

    /*** Step 3: TOTAL aid of ALL channels ***/

    (function(step3, undefined) { // Step 3 {{{

        // Prepare data
        var summary_data_map = d3.nest()
            .key(function(e) { return e.year; })
            .key(function(e) { return e.type; })
            .key(function(e) { return e.level; })
            .map(summary_data);

        var data = [
            {
                label: ["Gesamt"],
                amount:
            	(+summary_data_map["2010"]["développement"]["Confédération"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Confédération"][0].money) +
                (+summary_data_map["2010"]["développement"]["Cantons"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Cantons"][0].money) +
                (+summary_data_map["2010"]["développement"]["Communes"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Communes"][0].money)+
                (+summary_data_map["2010"]["développement"]["ONG"][0].money) +
                (+summary_data_map["2010"]["sudest"]["ONG"][0].money)
        	}
        ];
        
        // Compute location of step 3 bubble
        var step3bubble_xpos = function(d, i) {
            return width / 2;
        }
        var step3bubble_ypos = function(d, i) {
            return heights.step1 + heights.step2 + margins.step3.top;
        }
        // Add step 3 bubble
        svg_bubbles.selectAll("circle.step3bubble")
            .data(data)
          .enter()
            .append("circle")
            .attr("class", "step3bubble bubble")
            .attr("cx",  step3bubble_xpos)
            .attr("cy", step3bubble_ypos)
            .attr("r", function(d) { return bubble_radius(d.amount / 1000); })
            .attr("transform", "translate(0,200)");
            
        // Add labels
        svg_labels.selectAll("g.step3.label")
            .data(data)
          .enter()
            .append("g.step3.label");
        svg_labels.selectAll("g.step3.label")
            .data(data)
          .enter()
            .append("text")
            .attr("x", step3bubble_xpos)
            .attr("y", step3bubble_ypos)
            .text(function(d) { return d.label[0]; })
            .attr("font-family", "Museo-slab")
            .attr("font-size", "25px")
            .attr("text-anchor", "middle")
            .attr("fill", "#888280")
            .attr("transform", "translate(0,190)");
        svg_labels.selectAll("g.step3.label")
            .data(data)
          .enter()
            .append("text")
            .attr("x", step3bubble_xpos)
            .attr("y", step3bubble_ypos)
            .text(function(d) { return money_format(d.amount); })
            .attr("font-family", "Museo-slab")
            .attr("font-size", "25px")
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("transform", "translate(0,214)");            
            
       // Add the total bubble to the global node list
        svg_bubbles.selectAll("circle.step3bubble")[0].forEach(function(e, i) {
            var pos = get_real_position(e);
            step_2_3_nodes.push({
                id: 300 + i,
                x: pos.x,
                y: pos.y,
            });
            step_3_4_nodes.push({
                id: 300 + i,
                x: pos.x,
                y: pos.y,
            });
        });
                
        // Link all second aggregation bubbles to the total bubble.
        var total_bubble = step_2_3_nodes.filter(function(d) { return d.id == 300; })[0];
        step_2_3_nodes.filter(function(d) { return d.id >= 200 & d.id < 300; }).forEach(function(d) {
            step_2_3_links.push({
                source: d,
                target: total_bubble,
                value: 1
            });
        });
            
        // Draw links as bézier curves
        svg_lines.selectAll(".link.step2.step3")
            .data(step_2_3_links)
          .enter().append("path")
            .attr("class", "link step2 step3")
            .attr("d", function(d) {
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy);
                return "M" + d.source.x + "," + d.source.y + // Start point
                       "C" + d.source.x + "," + (d.source.y + (Math.abs(dy) / 1.6)) + // First control point
                       " " + d.target.x + "," + (d.target.y - (Math.abs(dy) / 1.6)) + // Second control point
                       " " + d.target.x + "," + d.target.y; // Target point
            });

    }(window.step3 = window.step3 || {})); // }}}

    /*** Step 4: Distribution by NGO ***/

    (function(step4, undefined) { // Step 4 {{{
    
        // Prepare data
        var data = ngo_top;
      
        // Compute location of step 4 bubble
        var step4bubble_xpos = function(d, i) {
            var base = width / 11;
            base += i * (width / 13);
            return base;
        }
        var step4bubble_ypos = function(d, i) {
            var base = heights.step1 + heights.step2 + heights.step3 + margins.step4.top - 460;
            /* Variante 1: zwei Reihen 
            if (i % 2 == 0) {
              base += 200;
            } */
            /* Variante 2: Linear schräg */
            base += ((heights.step4 / 11) * (11 - i)); 
            return base;
        }
        // Add step 4 bubble
        svg_bubbles.selectAll("circle.step4bubble")
            .data(data)
          .enter()
            .append("circle")
            .attr("class", "step4bubble bubble")
            .attr("cx",  step4bubble_xpos)
            .attr("cy", step4bubble_ypos)
            .attr("r", function(d) { return bubble_radius(d.amount / 1000); })
            .attr("transform", "translate(0,200)");
            
        // Add labels
        svg_labels.selectAll("g.step4.label")
            .data(data)
          .enter()
            .append("g.step4.label");
        svg_labels.selectAll("g.step4.label")
            .data(data)
          .enter()
            .append("text")
            .attr("x", step4bubble_xpos)
            .attr("y", step4bubble_ypos)
            .text(function(d) { return d.label[0]; })
            .attr("font-family", "Museo-slab")
            .attr("font-size", "12.5px")
            .attr("text-anchor", "middle")
            .attr("fill", "#888280")
            .attr("transform", "translate(0,190)");
        svg_labels.selectAll("g.step4.label")
            .data(data)
          .enter()
            .append("text")
            .attr("x", step4bubble_xpos)
            .attr("y", step4bubble_ypos)
            .text(function(d) { return money_format(d.amount); })
            .attr("font-family", "Museo-slab")
            .attr("font-size", "12.5px")
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("transform", "translate(0,214)");            
            
       // Add the total bubble to the global node list
        svg_bubbles.selectAll("circle.step4bubble")[0].forEach(function(e, i) {
            var pos = get_real_position(e);
            step_3_4_nodes.push({
                id: 400 + i,
                x: pos.x,
                y: pos.y,
            });
        });
                
        // Link all second aggregation bubbles to the total bubble.
        var total_bubble = step_3_4_nodes.filter(function(d) { return d.id == 300; })[0];
        step_3_4_nodes.filter(function(d) { return d.id >= 400 & d.id < 500; }).forEach(function(d) {
            step_3_4_links.push({
                source: total_bubble,
                target: d,
                value: 1
            });
        });
            
        // Draw links as bézier curves
        svg_lines.selectAll(".link.step3.step4")
            .data(step_3_4_links)
          .enter().append("path")
            .attr("class", "link step3 step4")
            .attr("d", function(d) {
                var dx = d.target.x - d.source.x,
                    dy = d.target.y - d.source.y,
                    dr = Math.sqrt(dx * dx + dy * dy);
                return "M" + d.source.x + "," + d.source.y + // Start point
                       "C" + d.source.x + "," + (d.source.y + (Math.abs(dy) / 1.6)) + // First control point
                       " " + d.target.x + "," + (d.target.y - (Math.abs(dy) / 1.6)) + // Second control point
                       " " + d.target.x + "," + d.target.y; // Target point
            });
    
    
    }(window.step4 = window.step4 || {})); // }}}

    /*** Step 5: distribution by Country ***/

    (function(step5, undefined) { // Step 5 {{{

        /*** World map ***/

        // Remove Antarctica from dataset
        for (var i = 0; i < world_topo.objects["countries"].geometries.length; i++) {
            if (world_topo.objects["countries"].geometries[i].id == "ATA") {
                world_topo.objects["countries"].geometries.splice(i, 1);
                break;
            }
        }

        // Calculate projection and position
        var offset = [width / 2, heights.step1 + heights.step2 + heights.step3 + heights.step4 + (heights.step5 / 2)];
        var world_projection = d3.geo.mercator()
            .rotate([0, 0])
            .scale(850)
            .translate(offset);

        // Draw countries
        var world_path = d3.geo.path().projection(world_projection);
        svg_lines.append("path")
            .datum(topojson.object(world_topo, world_topo.objects["countries"]))
            .attr("d", world_path)
            .attr("class", "countries area-region");
            
    }(window.step5 = window.step5 || {})); // }}}

};

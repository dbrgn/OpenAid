var width = 960;
var heights = {
    step1: 800,
    step2: 700,
    step3: 500,
    step4: 700,
    step5: 900,
    total: 3600
};
var margins = {
    step1: {top: 100, bottom: 0, left: 60, right: 60},
    step2: {top: 0, bottom: 0, left: 0, right: 0},
    step3: {top: 0, bottom: 0, left: 0, right: 0},
    step4: {top: 0, bottom: 0, left: 0, right: 0},
    step5: {top: 0, bottom: 0, left: 0, right: 0}
}

var projection = d3.geo.albers()
    .rotate([0, 0])
    .center([8.43, 46.8])
    .scale(13600);

var bubble_area = d3.scale.linear()
    .range([20, 150 * 150 * Math.PI]);

var bubble_radius = function(value) {
    return Math.sqrt(bubble_area(value) / Math.PI);
}
 
var path = d3.geo.path()
    .projection(projection);

var all_nodes = [], all_links = [];

var svg = d3.select("#svg").append("svg")
    .attr("width", width)
    .attr("height", heights.total);

queue()
    .defer(d3.json, "geodata/switzerland.topo.json")
    .defer(d3.json, "geodata/switzerland.geo.json")
    .defer(d3.json, "geodata/world.topo.json")
    .defer(d3.tsv, "cleaned_data/statistiken_2011.kantone.tsv") 
    .defer(d3.tsv, "cleaned_data/statistiken_2011.alles.tsv") 
    .await(ready);
 
function ready(error, topology, canton_shapes, world_topo, canton_data, summary_data) {

    var money_items_2010 = d3.nest().key(function(e) { return e.year; }).map(summary_data)["2010"];
    var total_money_2010 = d3.sum(money_items_2010.map(function(e) { return +e.money; }));
    bubble_area.domain([0, total_money_2010 / 1000]);

    (function(step1, undefined) {

        /*** SWITZERLAND ***/

        svg.append("path")
            .datum(topojson.object(topology, topology.objects["swiss-cantons"]))
            .attr("d", path)
            .attr("class", "cantons areaRegion");

        /*svg.append("path")
            .datum(topojson.mesh(topology, topology.objects["swiss-municipalities"], function(a, b) { return a.properties.bfsNo !== b.properties.bfsNo }))
            .attr("d", path)
            .attr("class", "municipality-boundary");*/

        svg.append("path")
            .datum(topojson.mesh(topology, topology.objects["swiss-cantons"], function(a, b) { return a.properties.no !== b.properties.no}))
            .attr("d", path)
            .attr("class", "canton-boundary");

        svg.append("path")
            .datum(topojson.mesh(topology, topology.objects["swiss-cantons"], function(a, b) { return a.properties.no === b.properties.no; }))
            .attr("d", path)
            .attr("class", "land-boundary");

   
        /*** DORLING CARTOGRAM ***/

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
                x: xy[0],
                y: xy[1],
                gravity: {x: xy[0], y: xy[1]},
                r: bubble_radius(value),
                value: value
            };
        });
        all_nodes = all_nodes.concat(nodes);

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

                svg.selectAll("circle.cantonbubble")
                    .attr("cx", function(d) { return d.x; })
                    .attr("cy", function(d) { return d.y; });
            });

        svg.selectAll("circle.cantonbubble")
            .data(nodes)
          .enter()
            .append("circle")
            .attr("class", "cantonbubble bubble")
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", function (d) { return d.r; });

    }(window.step1 = window.step1 || {}));


    (function(step2, undefined) {

        var summary_data_map = d3.nest()
            .key(function(e) { return e.year; })
            .key(function(e) { return e.type; })
            .key(function(e) { return e.level; })
            .map(summary_data);

        var data = [
            (+summary_data_map["2010"]["développement"]["Confédération"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Confédération"][0].money),
            (+summary_data_map["2010"]["développement"]["Cantons"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Cantons"][0].money) +
                (+summary_data_map["2010"]["développement"]["Communes"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Communes"][0].money),
            (+summary_data_map["2010"]["développement"]["ONG"][0].money) +
                (+summary_data_map["2010"]["sudest"]["ONG"][0].money),
        ];

        svg.selectAll("circle.step2bubble")
            .data(data)
          .enter()
            .append("circle")
            .attr("class", "step2bubble bubble")
            .attr("cx", function(d, i) { return (i + 1) * 2 * (width / 6) - (width / 6); })
            .attr("cy", heights.step1 + margins.step2.top)
            .attr("r", function(d) { return bubble_radius(d / 1000); })
            .attr("transform", function(d, i) {
                var xoffset = 0;
                    yoffset = 0;
                if (i == 0) {
                    xoffset = 50;
                    yoffset = 150;
                } else if (i == 2) {
                    xoffset = -50;
                    yoffset = 150;
                }
                return "translate(" + xoffset + "," + yoffset + ")"
            });

        // Add the three "aggregation bubbles" to the global node list
        svg.selectAll("circle.step2bubble")[0].forEach(function(e, i) {
            all_nodes.push({
                id: 200 + i,
                x: e.getAttribute("cx"),
                y: e.getAttribute("cy"),
            });
        });

        // Link all canton nodes to the second aggregation bubble
        all_nodes.filter(function(d) { return d.id < 200; }).forEach(function(d) {
            all_links.push({
                from: d.id,
                to: 201,
                value: 1
            });
        });

    }(window.step2 = window.step2 || {}));

   (function(step3, undefined) {
        // Total Aid of all channels
        var summary_data_map = d3.nest()
            .key(function(e) { return e.year; })
            .key(function(e) { return e.type; })
            .key(function(e) { return e.level; })
            .map(summary_data);

        var data = [
            (+summary_data_map["2010"]["développement"]["Confédération"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Confédération"][0].money) +
                (+summary_data_map["2010"]["développement"]["Cantons"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Cantons"][0].money) +
                (+summary_data_map["2010"]["développement"]["Communes"][0].money) +
                (+summary_data_map["2010"]["sudest"]["Communes"][0].money)+
                (+summary_data_map["2010"]["développement"]["ONG"][0].money) +
                (+summary_data_map["2010"]["sudest"]["ONG"][0].money)
        ];

        window.data = data;
        svg.selectAll("circle.step3bubble")
            .data(data)
          .enter()
            .append("circle")
            .attr("class", "step3bubble bubble")
            .attr("cx",  width / 2)
            .attr("cy", heights.step1 + heights.step2 + margins.step3.top)
            .attr("r", function(d) { return bubble_radius(d / 1000); })

  }(window.step3 = window.step3 || {}));


   (function(step4, undefined) {   

        /*** World map 
        var worldProjection = d3.geo.albers()
            .rotate([0, 0])
            .center([8.43, 46.8])
            .scale(100);

       var worldPath = d3.geo.path().projection(worldProjection);
       svg.append("path")
            .datum(topojson.object(world_topo, world_topo.objects["countries"]))
            .attr("d", worldPath)
            .attr("cx", margins.step4.left)
            .attr("cy", heights.step1 + heights.step2 + heights.step3 + margins.step3.top)
            .attr("class", "countries areaRegion");
            */
   }(window.step4 = window.step4 || {}));

    (function(nodelinks, undefined) {

        svg.selectAll(".link")
            .data(all_links)
          .enter().append("path")
            .attr("class", "link")
            /*.attr("x1", function(d) { return all_nodes.filter(function(dd) { return dd.id == d.from; })[0].x; })
            .attr("y1", function(d) { return .y; })
            .attr("x2", function(d) { return all_nodes.filter(function(dd) { return dd.id == d.to; })[0].x; })
            .attr("y2", function(d) { return all_nodes.filter(function(dd) { return dd.id == d.to; })[0].y; })*/
            .attr("d", function(d) {
                var source = all_nodes.filter(function(dd) { return dd.id == d.from; })[0];
                var target = all_nodes.filter(function(dd) { return dd.id == d.to; })[0];
                var dx = target.x - source.x,
                    dy = target.y - source.y,
                    dr = Math.sqrt(dx * dx + dy * dy);
                return "M" + source.x + "," + source.y +
                       "C" + source.x + "," + source.y + " " + source.x + "," + (source.y + (dy / 2)) + " " + target.x + "," + target.y;
            });

    }(window.nodelinks = window.nodelinks || {}));

};
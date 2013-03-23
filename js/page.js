$(document).ready(function () {

    $('#navigation a').bind('click.scrolling', function(e) {
        $(this).parents('ul').find('a').removeClass('active');
        $(this).addClass('active');

        var $anchor = $(this);

        $('html, body').stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top
        }, 1000);

        e.preventDefault();
    });

    $(window).bind('scroll.scrolling', function(e) {
        var scrollTop = $(window).scrollTop();

        var allTitles = $('section');
        for (var i = 0; i < allTitles.length; i++) {
            if ($(allTitles[i]).find('h2').offset().top + 200 > scrollTop) {
                var obj = $('#navigation').find('a[href="#' + $(allTitles[i]).attr('id') + '"]');
                obj.parents('ul').find('a').removeClass('active');
                obj.addClass('active');
                return;
            }
        }
    });

});
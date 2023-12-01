// Get the URL of the current page (without args or anything else)
function get_url() {
    return location.protocol + "//" + location.host + location.pathname;
}

// Perform AJAX query to search and populate results panel
var curQuery;
function query_search_regions(pushHistory=true) {
    // Abort any query that's still processing
    if (curQuery) {
        curQuery.abort();
    }

    // Save darkmode
    var isDark = $("html").attr("data-bs-theme") == "dark";

    // Get filter settings
    var isThrow = !$("#throw-area").is(":hidden");
    var isLand = !$("#land-area").is(":hidden");
    var smoke = $("#btn-check-smoke").prop("checked");
    var flash = $("#btn-check-flash").prop("checked");
    var molotov = $("#btn-check-molotov").prop("checked");
    var grenade = $("#btn-check-grenade").prop("checked");

    var radar = $("#radar");
    var throwArea = $("#throw-area");
    var landArea = $("#land-area");

    // calculate positions of the search regions
    var throwX = throwArea.position().left / radar.width();
    var throwY = throwArea.position().top / radar.width();
    var throwXEnd = throwX + (throwArea.outerWidth() / radar.width());
    var throwYEnd = throwY + (throwArea.outerHeight() / radar.height());

    var landX = landArea.position().left / radar.width();
    var landY = landArea.position().top / radar.width();
    var landXEnd = landX + (landArea.outerWidth() / radar.width());
    var landYEnd = landY + (landArea.outerHeight() / radar.height());

    // Builds args
    var args = {
        isThrow: isThrow, 
        isLand: isLand,
        smoke: smoke,
        flash: flash,
        molotov: molotov,
        grenade: grenade,
        isDark: isDark
    }

    if (isThrow) {
        args.throwX = throwX;
        args.throwXEnd = throwXEnd;
        args.throwY = throwY;
        args.throwYEnd = throwYEnd;
    }

    if (isLand) {
        args.landX = landX;
        args.landXEnd = landXEnd;
        args.landY = landY;
        args.landYEnd = landYEnd;
    }

    // Change URL and push search to history
    // pushHistory is sent false when loading from an arg'd URL, for example
    var url = get_url() + "?" + $.param(args);
    if (pushHistory) {
        history.pushState({ url: url, args: args }, "", url);
    } else {
        history.replaceState({ url: url, args: args }, "", url);
    }

    // curQuery = $.ajax({
    //     url: "/search",
    //     data: args,
    //     // Show loading spinner while results load
    //     beforeSend: function() {
    //         $("#search-results tbody").addClass("glow");
    //     },
    //     complete: function() {
    //         $("#search-results tbody").removeClass("glow");
    //     },
    //     success: function(data) {
    //         $("#search-results tbody").html(data);

    //         // Add result data to history state
    //         var newData = history.state;
    //         newData.results = data;

    //         history.replaceState(newData, "", history.state.url);
    //     }
    // });
}

// Reset all filters including search regions
function resetAllFilters() {
    $("#throw-area").removeAttr("style");
    $("#land-area").removeAttr("style");

    $("#btn-check-smoke").prop("checked", false);
    $("#btn-check-flash").prop("checked", false);
    $("#btn-check-molotov").prop("checked", false);
    $("#btn-check-grenade").prop("checked", false);
}

// When going back in browser history
window.addEventListener("popstate", function(e) {
    // Abort any query that's still processing
    if (curQuery) {
        curQuery.abort();
    }

    // If there is no state then we are back in starting position
    if (e.state == null || e.state == '') {
        resetAllFilters();
        return;
    }

    // Load search results for this state (if present)
    if (e.state.results != null) {
        $("#search-results tbody").html(e.state.results);
    }

    // Set filters
    $("#btn-check-smoke").prop("checked", e.state.args.smoke);
    $("#btn-check-flash").prop("checked", e.state.args.flash);
    $("#btn-check-molotov").prop("checked", e.state.args.molotov);
    $("#btn-check-grenade").prop("checked", e.state.args.grenade);

    // Position throw and land areas correctly
    var tl = (e.state.args.throwX * 100) + "%";
    var tt = (e.state.args.throwY * 100) + "%";
    var tw = (e.state.args.throwXEnd - e.state.args.throwX) * 100 + "%";
    var th = (e.state.args.throwYEnd - e.state.args.throwY) * 100 + "%";

    $("#throw-area").css("left", tl);
    $("#throw-area").css("top", tt);
    $("#throw-area").css("width", tw);
    $("#throw-area").css("height", th);

    var ll = (e.state.args.landX * 100) + "%";
    var lt = (e.state.args.landY * 100) + "%";
    var lw = (e.state.args.landXEnd - e.state.args.landX) * 100 + "%";
    var lh = (e.state.args.landYEnd - e.state.args.landY) * 100 + "%";

    $("#land-area").css("left", ll);
    $("#land-area").css("top", lt);
    $("#land-area").css("width", lw);
    $("#land-area").css("height", lh);
});

// Used when drag and resize events finish since jQuery stores these as px values
// which are not responsive!
function position_with_percentages(obj) {
    var radar = $("#radar");

    var l = (obj.position().left / radar.width()) * 100 + "%";
    var t = (obj.position().top / radar.height()) * 100 + "%";
    var w = (obj.outerWidth() / radar.width()) * 100 + "%";
    var h = (obj.outerHeight() / radar.height()) * 100 + "%";

    obj.css("left", l);
    obj.css("top", t);
    obj.css("width", w);
    obj.css("height", h);
}

function region_drag_stop_handler(e, ui) {
    position_with_percentages($(this));
    query_search_regions();
}

// set draggable, resizable behavior and handlers
function setup_search_region(obj) {
    obj.draggable({
        containment: "parent",
        stop: region_drag_stop_handler,
    }).resizable({
        containment: "parent",
        handles: "se",
        stop: region_drag_stop_handler
    });
}

setup_search_region($("#throw-area"))
setup_search_region($("#land-area"))

$("#mode-throwland-btn").on("click", function(e) {
    $("#throw-area").show();
    $("#land-area").show();
});

$("#mode-throw-btn").on("click", function(e) {
    $("#throw-area").show();
    $("#land-area").hide();
});

$("#mode-land-btn").on("click", function(e) {
    $("#throw-area").hide();
    $("#land-area").show();
});

// Reset search regions positions on reset button click
$("#reset-btn").click(function() {
    // Abort any query that's still processing
    if (curQuery) {
        curQuery.abort();
    }

    resetAllFilters();
    $("#search-results tbody").html("");

    // Clear url
    history.pushState("", "", get_url());
});

// Re-search whenever options change
$("#btn-check-smoke").click(query_search_regions);
$("#btn-check-flash").click(query_search_regions);
$("#btn-check-molotov").click(query_search_regions);
$("#btn-check-grenade").click(query_search_regions);

// Add zoom functionality
function zoom(obj, amount) {
    var vid = obj.parent().parent().siblings(".vid-container").children("video");
    vid.css("--zoom-amt", Math.max(1, parseFloat(vid.css("--zoom-amt")) + amount));
}

$("#search-results").on("click", ".zoomin-btn", function(e) {
    console.log("clicked");
    zoom($(this), 1);
})

$("#search-results").on("click", ".zoomout-btn", function(e) {
    zoom($(this), -1);
});

// Toggle showing the lineup bars
$("#search-results").on("click", ".crosshair-btn", function(e) {
    $(".xhair-line").toggle();
});

$(document).ready(function() {
    // If loading from a saved URL query results
    // Do not push history
    if ($("#search-results tbody").text().includes("Loading...")) {
        query_search_regions(false);
    }
});

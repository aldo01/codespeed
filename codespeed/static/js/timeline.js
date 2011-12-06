function setExeColors() {
  // Set color data attribute for all executables
  $("#executable > div.boxbody > ul > ul > li > input").each(function(index) {
    var color_id = index;
    while (color_id > seriesColors.length) { color_id -= seriesColors.length; }
    $(this).data('color', seriesColors[color_id]);
  });
}

function getColor(exe_id) {
  return $("#executable > div.boxbody")
                          .find("input[value='"+exe_id+"']")
                          .data('color');
}

function shouldPlotEquidistant() {
  return $("#equidistant").is(':checked');
}

function getConfiguration() {
  var config = new Object();
  config["exe"] = readCheckbox("input[name='executable']:checked");
  config["base"] = $("#baseline option:selected").val();
  config["ben"] = $("input[name='benchmark']:checked").val();
  config["env"] = $("input[name='environments']:checked").val();
  config["revs"] = $("#revisions option:selected").val();

  var branch = readCheckbox("input[name='branch']:checked");
  if (branch)
    config["bran"] = branch;
  config["equid"] = $("#equidistant").is(':checked') ? "on" : "off";
  return config;
}

function permalinkToChanges(commitid, executableid, environment) {
  window.location=changes_url + "?rev=" + commitid + "&" + "exe=" + executableid + "&env=" + environment;
}

function OnMarkerClickHandler(ev, gridpos, datapos, neighbor, plot) {
  if($("input[name='benchmark']:checked").val() == "grid") { return false; }
  if (neighbor) {
    var commitid = neighbor.data[3];
    // Get executable ID from the seriesindex array
    var executableid = seriesindex[neighbor.seriesIndex];
    var environment = $("input[name='environments']:checked").val();
    permalinkToChanges(commitid, executableid, environment);
  }
}

function renderPlot(data) {
  var plotdata = new Array();
  var series = new Array();
  var lastvalues = new Array();//hopefully the smallest values for determining significant digits.
  seriesindex = new Array();
  for (branch in data["branches"]) {
    // NOTE: Currently, only the "default" branch is shown in the timeline
    for (exe_id in data["branches"][branch]) {
      if (branch != "default") { label += " - " + branch; }
      var label = $("label[for*='executable" + exe_id + "']").html();
      series.push({"label":  label, "color": getColor(exe_id)});
      seriesindex.push(exe_id);
      plotdata.push(data["branches"][branch][exe_id]);
      lastvalues.push(data["branches"][branch][exe_id][0][1]);
    }
    //determine significant digits
    var digits = 2;
    var value = Math.min.apply( Math, lastvalues );
    if (value != 0) {
      while( value < 1 ) {
        value *= 10;
        digits++;
      }
    }
    $("#plotgrid").html('<div id="plot"></div><div id="plotdescription"></div>');

    if (data['benchmark_description']) {
      $("#plotdescription").html('<p class="note"><i>' + data['benchmark'] + '</i>: ' + data['benchmark_description'] + '</p>');
    }
  }
  if (data["baseline"] != "None") {
    series.push({
      "label": $("#baseline option:selected").html(), "color": baselineColor,
      showMarker: false,
      lineWidth: 1.5
    });
    plotdata.push(data["baseline"]);
  }
  var plotoptions = {
    title: {text: data['benchmark'], fontSize: '1.1em'},
    series: series,
    axes:{
      yaxis:{
        label: data['units'] + data['lessisbetter'],
        labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
        min: 0, autoscale:true,
        tickOptions:{formatString:'%.' + digits + 'f'}
      },
      xaxis:{
        renderer: (shouldPlotEquidistant()) ? $.jqplot.CategoryAxisRenderer : $.jqplot.DateAxisRenderer,
        label: 'Commit date',
        labelRenderer: $.jqplot.CanvasAxisLabelRenderer,
        tickOptions:{formatString:'%b %d'},
        pad: 1.01,
        autoscale:true,
        rendererOptions:{sortMergedLabels:true} /* only relevant when
                                $.jqplot.CategoryAxisRenderer is used */ 
      }
    },
    legend: {show: true, location: 'nw'},
    highlighter: {
      tooltipLocation: 'nw',
      yvalues: 4,
      formatString:'<table class="jqplot-highlighter">    <tr><td>date:</td><td>%s</td></tr> <tr><td>result:</td><td>%s</td></tr> <tr><td>std dev:</td><td>%s</td></tr> <tr><td>commit:</td><td>%s</td></tr></table>'
    },
    cursor:{zoom:true, showTooltip:false, clickReset:true}
  }
  if (series.length > 4) {
      // Move legend outside plot area to unclutter
      var labels = new Array();
      for (l in series) {
          labels.push(series[l]['label'].length)
      }

      var offset = 55 + Math.max.apply( Math, labels ) * 5.4;
      plotoptions.legend.location = 'ne';
      plotoptions.legend.xoffset = -offset;
      $("#plot").css("margin-right", offset + 10);
      var w = $("#plot").width();
      $("#plot").css('width', w - offset);
  }
  //Render plot
  plot = $.jqplot('plot',  plotdata, plotoptions);
}

function renderMiniplot(plotid, data) {
  var plotdata = new Array();
  for (branch in data['branches']) {
    var series = new Array();
    for (id in data['branches'][branch]) {
      series.push({
        "label": $("label[for*='executable" + id + "']").html(),
        "color": getColor(id)
      });
      plotdata.push(data['branches'][branch][id]);
    }
  }
  if (data["baseline"] != "None") {
    series.push({
      "color": baselineColor,
      showMarker: false,
      lineWidth: 1.5
    });
    plotdata.push(data["baseline"]);
  }

  var plotoptions = {
    title: {text: data['benchmark'], fontSize: '1.1em'},
    seriesDefaults: {lineWidth: 2, markerOptions:{style:'circle', size: 6}},
    series: series,
    axes: {
      yaxis: {
        min: 0, autoscale:true, showTicks: false
      },
      xaxis: {
        renderer:$.jqplot.DateAxisRenderer,
        pad: 1.01,
        autoscale:true,
        showTicks: false
      }
    },
    highlighter: {show:false},
    cursor:{showTooltip: false, style: 'pointer'}
  };
  plot = $.jqplot(plotid, plotdata, plotoptions);
}

function render(data) {
  $("#revisions").attr("disabled", false);
  $("#equidistant").attr("disabled", false);
  $("#plotgrid").html("");
  if(data["error"] != "None") {
    h = parseInt($("#content").css("height"));//get height for error message
    $("#plotgrid").html(getLoadText(data["error"], h, false));
    return 1;
  } else if ($("input[name='benchmark']:checked").val() == "show_none") {
    h = parseInt($("#content").css("height"));//get height for error message
    $("#plotgrid").html(getLoadText("Please select a benchmark on the left", h, false));
  } else if (data["timelines"].length == 0) {
    h = parseInt($("#content").css("height"));//get height for error message
    $("#plotgrid").html(getLoadText("No data available", h, false));
  } else if ($("input[name='benchmark']:checked").val() == "grid"){
    //Render Grid of plots
    $("#revisions").attr("disabled",true);
    $("#equidistant").attr("disabled", true);
    for (bench in data["timelines"]) {
      plotid = "plot_" + data["timelines"][bench]["benchmark_id"];
      $("#plotgrid").append('<div id="' + plotid + '" class="miniplot"></div>');
      $("#" + plotid).click(function() {
        var benchid = $(this).attr("id").slice(5);
        $("#benchmark_" + benchid).attr('checked', true);
        updateUrl();
      });
      renderMiniplot(plotid, data["timelines"][bench]);
    }
  } else {
    // render single plot when one benchmark is selected
    renderPlot(data["timelines"][0]);
    return 1;
  }
}

function refreshContent() {
  var h = parseInt($("#content").css("height"));//get height for loading text
  $("#plotgrid").fadeOut("fast", function() {
    $("#plotgrid").html(getLoadText("Loading...", h, true)).show();
    $.getJSON("json/", getConfiguration(), render);
  });
}

function updateUrl() {
  cfg = getConfiguration();
  for (param in cfg) {
    $.address.parameter(param, cfg[param])
  }
  $.address.update();
}

function valueOrDefault(obj, defaultObj) {
  return (obj) ? obj : defaultObj;
}

function initializeSite(event) {
  setValuesOfInputFields(event);
  $("#revisions"                ).change(updateUrl);
  $("#baseline"                 ).change(updateUrl);
  $("input[name='executable']"  ).change(updateUrl);
  $("input[name='branch']"      ).change(updateUrl);
  $("input[name='benchmark']"   ).change(updateUrl);
  $("input[name='environments']").change(updateUrl);
  $("#equidistant"              ).change(updateUrl);
}

function refreshSite(event) {
  setValuesOfInputFields(event);
  refreshContent();
}

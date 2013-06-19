/**
* Define global variables.
*/
var currentPosition = false; // We use this to store the human-readable geolocation returned by the GPS.
var currentPositionLatitude = false; // And this is just the current latitude returned by the GPS.
var currentPositionLongitude = false; // And as you might expect, this is the current longitude returned by the GPS.
var positionInterval = false; // We store a a "watch ID" when we set up navigator.geolocation.watchPosition so that we can reference it later.
var reportssent = 0; // A counter for the numbers of reports sent to OpenCellID.org.
var updatefrequency = 30000; // The default, in milliseconds (30000 = 30 seconds) for update frequency to OpenCellID.org.
var updateinterval = false; // We store a "setInterval ID" when we set up window.setInterval so that we can reference it later.

/**
* Enable sending reports to OpenCellID.org.
*/
function enableOpenCellIDSending() {
    // Start tracking the device's location using the GPS. If the location is found, then the success callback, successGeolocation, is called.
    navigator.geolocation.getCurrentPosition(successGeolocation, errorNoGeolocation, { enableHighAccuracy: true, maximumAge: 0 });
    // Check the box on the "Settings" page.
    $("#send_to_opencellid").attr('checked',true);
    // Show the list item on the main app page for the GPS location.
    $("#gpslocation").show();
    // Show the list item on the main app page for the number of reports sent.
    $("#reportssent_wrapper").show();
    // Clear any previously-set setInterval
    if (updateinterval) {
        clearInterval(updateinterval);
    }
    // Set up automatic updates, every "updatefrequency" milliseconds, to OpenCellID.org.
    updateinterval = window.setInterval(sendToOpenCellID,localStorage.updatefrequency);
}

/**
* Disable sending reports to OpenCellID.org.
*/
function disableOpenCellIDSending() {
    // Hide the list item on the main app page for the GPS location.
    $("#gpslocation").hide();
    // Hide the list item on the main app page for the number of reports sent.
    $("#reportssent_wrapper").hide();
    // If we were checking the GPS, then stop.
    if (positionInterval) {
        navigator.geolocation.clearWatch(positionInterval);
    }
    // Clear any previously-set setInterval.
    if (updateinterval) {
        clearInterval(updateinterval);
    }
}

/**
* Get the current cell ID from the device.
*/
function getCellID() {
    // See https://developer.mozilla.org/en-US/docs/Web/API/MozMobileConnection
	var conn = window.navigator.mozMobileConnection;
    // If we weren't able to establish the connection, then display an error.
	if (!conn || !conn.voice || !conn.voice.network) {
        $("#statusmessagetext").html("Unable to get Cell ID information from your device's API. Perhaps it's not supported or you have no SIM inserted?");
        $("#statusmessage").show();
	}
	else {
        // Update the main app screen with information about the cell we're connected to right now.
        $("#statusmessage").hide();
        $("#longName").html(conn.voice.network.longName);
        $("#gsmCellId").html(conn.voice.cell.gsmCellId);
        $("#network_identifiers").html(conn.voice.network.mcc + "/" + conn.voice.network.mnc + "/" + conn.voice.cell.gsmLocationAreaCode);
        $("#relSignalStrength").html(conn.voice.relSignalStrength);
    }
}

/**
* Success callback for geolocation. This gets called when the device learns its GPS position.
*/
function successGeolocation(position) {
    // Used to display position on the main app screen, the latitude and longitude rounded to 3 decimal places.
    currentPosition = (Math.round(position.coords.latitude * 100) / 100) + ","  + (Math.round(position.coords.longitude * 100) / 100);
    $("#location").html(currentPosition);
    // Current latitude.
    currentPositionLatitude = position.coords.latitude;
    // Current Longitude.
    currentPositionLongitude = position.coords.longitude;
    // If we currently had a watchPosition setup, then clear it.
    if (positionInterval) {
        navigator.geolocation.clearWatch(positionInterval);
    }
    // Set up a watchPosition to constantly poll the device for its location. On success updatePosition gets called.
    positionInterval = navigator.geolocation.watchPosition(updatePosition, noPositionFound, { enableHighAccuracy: true, maximumAge: 0 });
}

/**
* Error callback for geolocation. Right now we do, well, nothing.
*/
function errorNoGeolocation(error) {
}

/**
* Success callback for geolocation watchPosition. This gets called when the device updates its GPS position.
*/
function updatePosition(position) {
    // Update the current position and update the main app screen.
    currentPosition = (Math.round(position.coords.latitude * 1000) / 1000) + ","  + (Math.round(position.coords.longitude * 1000) / 1000);
    $("#location").html(currentPosition);
    // Update current latitude.
    currentPositionLatitude = position.coords.latitude;
    // Update current longitude.
    currentPositionLongitude = position.coords.longitude;
}

/**
* Error callback for geolocation watchPosition. Right now we do, well, nothing.
*/
function noPositionFound() {
}

/**
* Send reports to OpenCellID.org.
*/
function sendToOpenCellID() {
    // See https://developer.mozilla.org/en-US/docs/Web/API/MozMobileConnection
    // Could probably more efficiently integrate this with the getCellID function.
  var conn = window.navigator.mozMobileConnection;
  if (!conn || !conn.voice || !conn.voice.network) {
    return;
  }
    else {
        // If we have a GPS latitude, and we have an OpenCellID.org key, and we checked "on" for sending reports, then...
        if ((currentPositionLatitude) && (localStorage.opencellid !== '') && (localStorage.send_to_opencellid === 'on')) {
            // Set up an XMLHttpRequest
            var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});
            // This is the OpenCellID.org URL we need to ping. API documentation is at http://opencellid.org/api
            var geturl = "http://www.opencellid.org/measure/add?key=" + localStorage.opencellid + "&cellid=" + conn.voice.cell.gsmCellId + "&lac=" + conn.voice.cell.gsmLocationAreaCode + "&mcc=" + conn.voice.network.mcc + "&mnc=" + conn.voice.network.mnc + "&signal=" + conn.voice.relSignalStrength + "&lat=" + currentPositionLatitude + "&lon=" + currentPositionLongitude + "&measured_at=" + moment().format();
            xhr.open('GET', geturl, true);
            xhr.send();
            // Increment the counter of reports sent.
            reportssent = reportssent + 1;
            // Update the main app screen counter.
            $("#reportssent").html(reportssent);
        }
    }
}

/**
* The aforementioned "bunch of initializing code."
*/
function startUp() {
    // Get the current CellID and update the display 
    getCellID();
    // If we didn't previously save the update frequency, then put this into a localStorage item.
    if (localStorage.getItem("updatefrequency") === null) {
        window.localStorage.setItem("updatefrequency", updatefrequency);
    }
    // Update the OpenCellID.org API key value previously saved on the "Settings" page.
    $("#opencellid").val(localStorage.opencellid);
    // Update the OpenCellID.org update frequency value previously saved on the "Settings" page.
    $("#updatefrequency").val(localStorage.updatefrequency);
    // If we previously checked the "Send to OpenCellID.org" checkbox, then...
    if (localStorage.send_to_opencellid === 'on') {
        enableOpenCellIDSending();
    }
    // Update the display every second with the current cell ID information.
    window.setInterval(getCellID,1000);
}

/**
* When the app is launched, run a bunch of initializing code.
*/
startUp();

/**
* Handler for the tap on the "Settings" button on the main app screen.
*/
$('#settings-btn').bind('click', function () {
    $('#settings-view').removeClass('move-down');
    $('#settings-view').addClass('move-up');
});

/**
* Handler for the tap on the "Close" button on the settings screen.
*/
$('#close-btn').bind('click', function () {
    $('#settings-view').removeClass('move-up');
    $('#settings-view').addClass('move-down');
});

/**
* Handler for the tap on the "Done" button on the settings screen.
*/
$('#done-btn').bind('click', function () {
    // Store the OpenCellID.org API key in local storage.
    window.localStorage.setItem("opencellid", $("#opencellid").val());
    // Store the OpenCellID.org update frequency in local storage.
    window.localStorage.setItem("updatefrequency", $("#updatefrequency").val());
    // If the "Send to OpenCellID.org" checkbox is checked, then...
    if ($("#send_to_opencellid").is(':checked')) {
        // Store the OpenCellID.org checkbox setting, as "on", to local storage.
        window.localStorage.setItem("send_to_opencellid", 'on');
        // Enable OpenCellID.org updates.
        enableOpenCellIDSending();
        // Do a single update right away so that user doesn't need to wait for the update interval.
        sendToOpenCellID();
    } 
    // If the "Send to OpenCellID.org" checkbox is NOT checked, then...
    else {
        // Store the OpenCellID.org checkbox setting, as "off", to local storage.
        window.localStorage.setItem("send_to_opencellid", 'off');
        // Disable OpenCellID.org updates.
        disableOpenCellIDSending();
    }
    // Return to the main app screen.
    $('#settings-view').removeClass('move-up');
    $('#settings-view').addClass('move-down');
});

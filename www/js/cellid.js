/**
* Define global variables.
*/
var currentPosition 			= false; 	// We use this to store the human-readable geolocation returned by the GPS.
var currentPositionLatitude 	= false; 	// And this is just the current latitude returned by the GPS.
var currentPositionLongitude 	= false; 	// And as you might expect, this is the current longitude returned by the GPS.
var positionInterval 			= false; 	// We store a a "watch ID" when we set up navigator.geolocation.watchPosition so that we can reference it later.
var updatefrequency 			= 30000; 	// The default, in milliseconds (30000 = 30 seconds) for update frequency to our networks.
var updateinterval 				= false; 	// We store a "setInterval ID" when we set up window.setInterval so that we can reference it later.
var reportssent					= { 'reportssent_mozilla': 0, 'reportssent_opencellid': 0, 'reportssent_myurl' : 0 }; 		// A counter for the numbers of reports sent to our networks.

var	useDummyCell				= false; 	// Allows testing on Firefox on the desktop, where there is no GSM cell data (we use a dummy cell).
var dummyCell					= { voice: { cell: {}, network: {} } };		// Object to store "dummy" cell data in.
dummyCell.voice.type = 'gsm';
dummyCell.voice.cell.gsmCellId = '250014562';
dummyCell.voice.cell.gsmLocationAreaCode = '48000';
dummyCell.voice.network.mcc = '302';
dummyCell.voice.network.mnc = '610';
dummyCell.voice.relSignalStrength = '83';
dummyCell.voice.signalStrength = '1';

/**
* When the app is launched, run a bunch of initializing code.
*/
$(document).on("ready", function() {

    // If we didn't previously save the update frequency, then put this into a localStorage item.
    if (localStorage.getItem("updatefrequency") === null) {
        window.localStorage.setItem("updatefrequency", updatefrequency);
    }
    
    // Update the Mozilla Location Services nickname value previously saved on the "Settings" page.
    $("#mozilla_nickname").val(localStorage.mozilla_nickname);

    // Update the OpenCellID.org API key value previously saved on the "Settings" page.
    $("#opencellid").val(localStorage.opencellid);

    // Update the custom URL value previously saved on the "Settings" page.
    $("#myurl").val(localStorage.myurl);

    // Update the update frequency value previously saved on the "Settings" page.
    $("#updatefrequency").val(localStorage.updatefrequency);

	// Make the switches on the settings page into sliders; must do this before setting their values.
	$('#send_to_myurl').slider();
	$('#send_to_opencellid').slider();
	$('#send_to_mozilla').slider();

    // Check the boxes on the "Settings" page based on previously saved values.
	if (localStorage.send_to_myurl == 'on') {
	    $('#send_to_myurl').val("on").slider("refresh");
	}
	if (localStorage.send_to_opencellid == 'on') {
	    $('#send_to_opencellid').val("on").slider("refresh");
	}
	if (localStorage.send_to_mozilla == 'on') {
	    $('#send_to_mozilla').val("on").slider("refresh");
	}
	
    // Get the current CellID and update the display 
    getCellID();

    // Setup GPS, etc.
    enableSending();

    // Update the display every second with the current cell ID information.
    window.setInterval(getCellID,1000);

	/**
	* Handler for the tap on the "Done" button on the settings screen.
	*/
	$('#done-btn').bind('click', function () {
		// Store the OpenCellID.org API key in local storage.
		window.localStorage.setItem("opencellid", $("#opencellid").val());
		// Store the OpenCellID.org update frequency in local storage.
		window.localStorage.setItem("updatefrequency", $("#updatefrequency").val());

		// Store the Mozilla nickname in local storage.
		window.localStorage.setItem("mozilla_nickname", $("#mozilla_nickname").val());

		// Store the Mozilla nickname in local storage.
		window.localStorage.setItem("myurl", $("#myurl").val());

		// If the "Send to Mozilla" checkbox is checked, then...
		if ($("#send_to_mozilla").val() == 'on' ) {
			// Store the Mozilla checkbox setting, as "on", to local storage.
			window.localStorage.setItem("send_to_mozilla", 'on');
		} 
		else {
			window.localStorage.setItem("send_to_mozilla", '');
		}

		// If the "Send to OpenCellID.org" checkbox is checked, then...
		if ($("#send_to_opencellid").val() == 'on') {
			// Store the OpenCellID.org checkbox setting, as "on", to local storage.
			window.localStorage.setItem("send_to_opencellid", 'on');
		} 
		else {
			window.localStorage.setItem("send_to_opencellid", '');
		}

		// If the "Send to My URL" checkbox is checked, then...
		if ($("#send_to_myurl").val() == 'on' ) {
			// Store the Mozilla checkbox setting, as "on", to local storage.
			window.localStorage.setItem("send_to_myurl", 'on');
		} 
		else {
			window.localStorage.setItem("send_to_mozilla", '');
		}

		// Enable updates.
		enableSending();
		
		// Do a single update right away so that user doesn't need to wait for the update interval.
		sendToNetworks();

		$.mobile.changePage( "#list-view");

	});
});

/**
* Get the current cell ID from the device.
*/
function getCellID() {

	if (useDummyCell) {
		var conn = dummyCell;
	}
	else {
	    var conn = navigator.mozMobileConnection;
	}

    // If we weren't able to establish the connection, then display an error.
	if (!conn || !conn.voice || !conn.voice.network || !conn.voice.cell ) {
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
* Enable sending reports to OpenCellID.org.
*/
function enableSending() {

    // Start tracking the device's location using the GPS. If the location is found, then the success callback, successGeolocation, is called.
    navigator.geolocation.getCurrentPosition(successGeolocation, errorNoGeolocation, { enableHighAccuracy: true, maximumAge: 0 });

    // Clear any previously-set setInterval
    if (updateinterval) {
        clearInterval(updateinterval);
    }

    // Set up automatic updates, every "updatefrequency" milliseconds.
    updateinterval = window.setInterval(sendToNetworks,localStorage.updatefrequency);
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

    // Current Altitude.
    currentPositionAltitude = position.coords.altitude;

    // Current Accuracy.
    currentPositionAccuracy = position.coords.accuracy;

    // Current Altitude Accuracy.
    currentPositionAltitudeAccuracy = position.coords.altitudeAccuracy;

    // If we currently had a watchPosition setup, then clear it.
    if (positionInterval) {
        navigator.geolocation.clearWatch(positionInterval);
    }

    // Set up a watchPosition to constantly poll the device for its location. On success updatePosition gets called.
    positionInterval = navigator.geolocation.watchPosition(updatePosition, noPositionFound, { enableHighAccuracy: true, maximumAge: 0 });

	// Send an initial send to networks when we get our geolocation
	sendToNetworks();
}

/**
* Error callback for geolocation. Right now we do, well, nothing.
*/
function errorNoGeolocation(error) {
	$("#statusmessagetext").html("Unable to get position from GPS. Is Geolocation turn on for your device?");
	$("#statusmessage").show();
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
* Send reports to OpenCellID.org and/or Mozilla Location Services and/or my custom URL.
*/
function sendToNetworks() {

	if (useDummyCell) {
		var conn = dummyCell;
	}
	else {
	    var conn = navigator.mozMobileConnection;
	}

	if (!conn || !conn.voice || !conn.voice.network || !conn.voice.cell ) {
	    return;
	}
    else {

        // If we have a GPS latitude, and we have an OpenCellID.org key, and we checked "on" for sending reports, then...
        if ((currentPositionLatitude) && (localStorage.opencellid !== '') && (localStorage.send_to_opencellid === 'on')) {
            var url = "http://www.opencellid.org/measure/add?key=" + localStorage.opencellid + "&cellid=" + conn.voice.cell.gsmCellId + "&lac=" + conn.voice.cell.gsmLocationAreaCode + "&mcc=" + conn.voice.network.mcc + "&mnc=" + conn.voice.network.mnc + "&signal=" + conn.voice.relSignalStrength + "&lat=" + currentPositionLatitude + "&lon=" + currentPositionLongitude + "&measured_at=" + moment().format();
			sendXHR(url,'GET',null,'reportssent_opencellid',null);
        }
        
        // If we have a GPS latitude, and we checked "on" for sending reports to my URL, then...
        if ((currentPositionLatitude) && (localStorage.myurl !== '') && (localStorage.send_to_opencellid === 'on')) {
            var url = localStorage.myurl + "?cellid=" + conn.voice.cell.gsmCellId + "&lac=" + conn.voice.cell.gsmLocationAreaCode + "&mcc=" + conn.voice.network.mcc + "&mnc=" + conn.voice.network.mnc + "&signal=" + conn.voice.relSignalStrength + "&lat=" + currentPositionLatitude + "&lon=" + currentPositionLongitude + "&measured_at=" + moment().format();
			sendXHR(url,'GET',null,'reportssent_myurl',null);
        }
                
        // If we have a GPS latitude, and we checked "on" for sending reports to Mozilla, then...
        if ((currentPositionLatitude) && (localStorage.send_to_mozilla === 'on')) {
			var item = {
				lat: currentPositionLatitude,
				lon: currentPositionLongitude,
				time: moment().format(),
				accuracy: currentPositionAccuracy,
				altitude: currentPositionAltitude,
				altitude_accuracy: currentPositionAltitudeAccuracy,
				radio: "gsm",
				cell: [
					{
						radio: conn.voice.type,
						mcc: conn.voice.network.mcc,
						mnc: conn.voice.network.mnc,
						lac: conn.voice.network.gsmLocationAreaCode,
						cid: conn.voice.cell.gsmCellId,
						signal: conn.voice.signalStrength
					}
				]
			};
			
			items = [];
			items.push(item);
			
			var itemsPost = JSON.stringify({items: items});

            var url = "https://location.services.mozilla.com/v1/submit"
			var extraheaders = [
					[ 'X-Nickname', localStorage.mozilla_nickname ],
					[ 'Content-Type', 'application/json' ] ];
					
			sendXHR(url,'POST',itemsPost,'reportssent_mozilla',extraheaders);
        }
    }
}

function sendXHR(url,posttype,payload,updatecounter,extraheaders) {

	// Set up an XMLHttpRequest
	var xhr = new XMLHttpRequest({mozSystem: true, responseType: 'json'});

	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && (xhr.status == 200 || xhr.status == 204)) {
			// Increment the counter of reports sent.
			reportssent[updatecounter] = reportssent[updatecounter] + 1;
			// Update the main app screen counter.
			$('#' + updatecounter).html(reportssent[updatecounter]);
		}
		else if (xhr.readyState == 4 && xhr.status == 400) {
			alert("Error sending to " + url);
		}
	}

	xhr.open(posttype, url, true);
	if (!extraheaders === null) {
		extraheaders.forEach(function(entry) {
			xhr.setRequestHeader(entry[0],entry[1]);
		});
	}	
	xhr.send(payload);
}

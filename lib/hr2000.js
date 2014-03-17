/*
 * node-hr2000
 * https://github.com/leo/node-hr2000
 *
 * Copyright (c) 2014 Leo Haddad Carneiro
 * Licensed under the MIT license.
 */

/****
 * How to use:
 * var HR2000 = require('HR2000').HR2000
 * var lib = new HR2000()
 *
 * List of HR2000+ endpoints
 * EP1Out = 0x01
 * EP2In = 0x82
 * EP6In = 0x86
 * EP1In = 0x81
 */
 /*jshint -W117 */
 /*jshint -W083 */
var us = require('underscore')
var usb = require("usb")

var HR2000Factory = function() {

	var factory = this

	var _options = {
		VID: 0x2457,
		PID: 0x101E,
		integrationTime: 3000,
		strobleEnableStatus: 0,
		shutdownMode: 0,
		triggerMode: 0,
	}


	function HR2000(options) {
		this._internal = {
			claimed: false
		}

		// this.endpoints = new Endpoints()
		this.funcs = new HR2000Funcs()
		this.spectroData = new HR2000Data(function(){})

		this.options = us.defaults(options || {}, _options);

		var VID = this.options.VID, PID = this.options.PID
		this.device = usb.findByIds(VID, PID)
		this.device.open()

		this.iface = this.device.interfaces[0]

		this.configEndPoints()

		//configure generic functions to send data
		//ex: this.requestSpectra()
		var funcs = this.funcs.getFuncs()

		for(var i = 0; i < funcs.length; i++) {
			var func = funcs[i]
			if(typeof(HR2000.prototype[func.name]) === 'undefined') {
				HR2000.prototype[func.name] = function(callback, extraData) {
					this.genericFunction(callback, func.data, extraData)
				}
			}
		}

		this.claim()
	}

	HR2000.prototype.requestSpectra = function(callback) {
		var func = this.funcs.getByName('requestSpectra')

		this.spectroData = new HR2000Data(callback)
		this.genericFunction.call(this, callback, func)
	}

	/**
	 * Set the settings of Endpoints
	 */
	HR2000.prototype.configEndPoints = function() {
		var self = this
		var iface = this.iface
		this.EP1In = iface.endpoint(0x81)
		this.EP1Out = iface.endpoint(0x01)
		this.EP2In = iface.endpoint(0x82)

		//spectro data
		this.EP2In.on("data", function(data) {
			console.log("EP2In data")
			self.spectroData.addData(data)
		})

		//all others data
		this.EP1In.on("data", function(data) {
			console.log("EP1In data")
			if(self.callback !== null)
				self.callback(data)
		})
	}

	/**
	 * Claim for device and start the stream of endpoints
	 */
	HR2000.prototype.claim = function() {
		if(this._internal.claimed) return

		var iface = this.iface
		if(iface.isKernelDriverActive()) iface.detachKernelDriver()
		iface.claim()

		this.EP1In.startStream(1, 512)
		this.EP2In.startStream(1, 512)

		this._internal.claimed = true
	}

	/**
	 * Stop streams and release device
	 */
	HR2000.prototype.release = function() {
		if(!this._internal.claimed) return

		this.EP1In.stopStream()
		this.EP2In.stopStream()
		this.iface.release()

		this._internal.claimed = false
	}

	/**
	 * Provide a generic function to send data to spectrometer
	 * @callback - Function(data) - a function to callback, receive a data 
	 * @data - Int - integer referenced to the internal method of spectrometer
	 * @extraData - ByteArray - a array of extra datas, some functions need it
	 */
	HR2000.prototype.genericFunction = function(callback, data, extraData) {
		var EP1Out = this.EP1Out
		var buffer = new Buffer(1)
		buffer[0] = data
		if(extraData !== null) {
			buffer = new Buffer(extraData.length + 1)
			buffer[0] = data
			buffer.push(extraData)
		}

		if(callback !== null) 
			this.callback = callback
		else
			this.callback = null

		EP1Out.write(buffer)
	}

	factory.HR2000 = HR2000
}

var factory = new HR2000Factory()
module.exports = factory;
	
/**
 * HR2000Data is used to receive and convert the data of spectros
 * All Spectometer specifications can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20HR2000+.pdf
 */
function HR2000Data(callback) {
	this.totalFrames = 8
	this.output = []
	this.callback = callback ? callback : function() {};
	this.counter = 0
}

/**
 * Clear cache
 */
HR2000Data.prototype.clear = function() {
	this.output = []
	this.counter = 0
}

/**
 * Add data to cache
 * All calls is asynchronous and the data has to be merged
 */
HR2000Data.prototype.addData = function(data) {
	var self = this
	data = this.convertData(data)
	this.output.push(data)
	this.counter++
	if(this.counter === this.totalFrames)
		this.callback(self.getData())
}

/**
 * Return the data output
 */
HR2000Data.prototype.getData = function() {
	return this.output
}

/**
 * Convert the data to output
 *
 * * Removed from documentation:
 * All pixel values are 16-bit values organized in LSB | MSB order. Bit 13 has 
 * to be flipped for every pixel before converting to an integer. This is 
 * equivalent to performing a xor 0x20 with MSB. There is an additional
 * packet containing one value that is used as a flag to insure proper 
 * synchronization between the PC and HR2000+ */
HR2000Data.prototype.convertData = function(data) {
	data = data.toString('hex')
	var size = data.length / 2
	var output = [size]
	console.log('size', size)
	for(var i = 0; i < size; i+=2) {
		var part = data.substring(i,i+2)
		output[i/2] = parseInt(part ^0x20, 16)
	}
	return output
}
/**
 * HR2000Funcs is responsible for the internal functions of spectrometer
 * All functions can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20HR2000+.pdf
 */
function HR2000Funcs() {
	function HR2000Func(data, name, version) {
		this.name = name
		this.data = data
		this.version = version
	}

	this.pfuncs = [
		new HR2000Func(0x01, 'intialize', 0.9),
		new HR2000Func(0x02, 'setIntegrationTime', 0.9),
		new HR2000Func(0x03, 'setStrobeEnableStatus', 0.9),
		new HR2000Func(0x04, 'setShutdownMode', 0.9),
		new HR2000Func(0x05, 'queryInformation', 0.9),
		new HR2000Func(0x06, 'writeInformation', 0.9),

		new HR2000Func(0x09, 'requestSpectra', 0.9),
		new HR2000Func(0x0A, 'setTriggerMode', 0.9),
		new HR2000Func(0x0B, 'queryNumberPlugins', 0.9),
		new HR2000Func(0x0C, 'queryPluginIdentifiers', 0.9),
		new HR2000Func(0x0D, 'detectPlugins', 0.9),

		new HR2000Func(0x60, 'generalICRead', 0.9),
		new HR2000Func(0x61, 'generalICWrite', 0.9),
		new HR2000Func(0x62, 'generalSpiIo', 0.9),
		new HR2000Func(0x68, 'pscoRead', 0.9),
		new HR2000Func(0x69, 'pscoWrite', 0.9),
		new HR2000Func(0x6A, 'writeRegisterInformation', 0.9),
		new HR2000Func(0x6B, 'readRegisterInformation', 0.9),
		new HR2000Func(0x6C, 'readPcbTemperature', 0.9),
		new HR2000Func(0x6D, 'readIrradianceCalibrationFactors', 0.9),
		new HR2000Func(0x6E, 'writeIrradianceCalibrationFactors', 0.9),

		new HR2000Func(0xFE, 'queryStatus', 0.9),
	]
}

HR2000Funcs.prototype.getByType = function(type, name) {
	var size = this.pfuncs.length
	for(var i = 0; i < size; i++) {
		if(name === this.pfuncs[i][type])
			return this.pfuncs[i]
	}
	return null
}

HR2000Funcs.prototype.getByName = function(name) {
	return this.getByType('name', name)
}
HR2000Funcs.prototype.getByData = function(data) {
	return this.getByType('data', data)
}
HR2000Funcs.prototype.getFuncs = function() {
	return this.pfuncs
}

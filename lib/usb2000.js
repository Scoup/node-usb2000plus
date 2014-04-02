/**
 * USB2000Data is used to receive and convert the data of spectros
 * All Spectometer specifications can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20USB2000+.pdf
 */
function USB2000Data(callback) {
	var self = this
	this.errorTimeout = 5000
	this.totalFrames = 8
	this.output = []
	this.callback = callback ? callback : function() {};
	this.counter = 0
	this.timeout = setTimeout(function(){
		var error = "Timeout on request " + self.errorTimeout + "ms"
		self.callback(error, null)
	}, this.errorTimeout)
}

/**
 * Clear cache
 */
USB2000Data.prototype.clear = function() {
	this.output = []
	this.counter = 0
}

/**
 * Add data to cache
 * All calls is asynchronous and the data has to be merged
 */
USB2000Data.prototype.addData = function(data) {
	var self = this
	data = this.convertData(data)
	this.output.concat(data)
	this.counter++
	if(this.counter === this.totalFrames){
		clearTimeout(this.timeout)
		this.callback(null, self.getData())
	}
}

/**
 * Return the data output
 */
USB2000Data.prototype.getData = function() {
	return this.output
}

/**
 * Convert the data to output
 *
 */
USB2000Data.prototype.convertData = function(data) {
	var size = data.length
	var output = [size]
	if(size == 1) return
	var j = 0;
	for(var i = 0; i < size; i+=2) {
		var b1 = data[i]
		var b2 = data[i+1]
		// b2 = b2 ^ 0x20 //bit 13 flipped

		var lsb = this.zeroFill(b1.toString(2), 8)
		var msb = this.zeroFill(b2.toString(2), 8)

		var pixel = msb + lsb;
		pixel = this.zeroFill(pixel, 16)
		output.push(parseInt(pixel,2))
		j++
	}
	this.output = this.output.concat(output)
	return output
}

USB2000Data.prototype.zeroFill = function( number, width ) {
	width -= number.toString().length;
	if ( width > 0 )
		return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
	return number + ""; // always return a string
}

USB2000Data.prototype.reverseBits = function(num, numBits) {
	var reversedNum
	var mask = 0

	mask = (0x1 << (numBits/2)) -1
	if(numBits === 1) return num
	reversedNum = this.reverse(num >> numBits / 2, numBits / 2) | this.reverse((num & mask), numBits/2) << numBits/2;
	return reversedNum
}
/**
 * USB2000Funcs is responsible for the internal functions of spectrometer
 * All functions can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20USB2000+.pdf
 */
function USB2000Funcs() {
	function USB2000Func(data, name, version) {
		this.name = name
		this.data = data
		this.version = version
	}

	this.pfuncs = [
		new USB2000Func(0x01, 'intialize', 0.9),
		new USB2000Func(0x02, 'setIntegrationTime', 0.9),
		new USB2000Func(0x03, 'setStrobeEnableStatus', 0.9),
		new USB2000Func(0x04, 'setShutdownMode', 0.9),
		new USB2000Func(0x05, 'queryInformation', 0.9),
		new USB2000Func(0x06, 'writeInformation', 0.9),

		new USB2000Func(0x09, 'requestSpectra', 0.9),
		new USB2000Func(0x0A, 'setTriggerMode', 0.9),
		new USB2000Func(0x0B, 'queryNumberPlugins', 0.9),
		new USB2000Func(0x0C, 'queryPluginIdentifiers', 0.9),
		new USB2000Func(0x0D, 'detectPlugins', 0.9),

		new USB2000Func(0x60, 'generalICRead', 0.9),
		new USB2000Func(0x61, 'generalICWrite', 0.9),
		new USB2000Func(0x62, 'generalSpiIo', 0.9),
		new USB2000Func(0x68, 'pscoRead', 0.9),
		new USB2000Func(0x69, 'pscoWrite', 0.9),
		new USB2000Func(0x6A, 'writeRegisterInformation', 0.9),
		new USB2000Func(0x6B, 'readRegisterInformation', 0.9),
		new USB2000Func(0x6C, 'readPcbTemperature', 0.9),
		new USB2000Func(0x6D, 'readIrradianceCalibrationFactors', 0.9),
		new USB2000Func(0x6E, 'writeIrradianceCalibrationFactors', 0.9),

		new USB2000Func(0xFE, 'queryStatus', 0.9),
	]
}

USB2000Funcs.prototype.getByType = function(type, value) {
	var size = this.pfuncs.length
	for(var i = 0; i < size; i++) {
		if(value === this.pfuncs[i][type])
			return this.pfuncs[i]
	}
	return null
}

USB2000Funcs.prototype.getByName = function(name) {
	return this.getByType('name', name)
}
USB2000Funcs.prototype.getByData = function(data) {
	return this.getByType('data', data)
}
USB2000Funcs.prototype.getFuncs = function() {
	return this.pfuncs
}
/*
 * node-usb2000plus
 * https://github.com/leo/node-usb2000plus
 *
 * Copyright (c) 2014 Léo Haddad M. C. Carneiro 
 * Licensed under the MIT license.
 */

/****
 * How to use:
 * var USB2000 = require('USB2000').USB2000
 * var lib = new USB2000()
 *
 * List of USB2000+ endpoints
 * EP1Out = 0x01
 * EP2In = 0x82
 * EP6In = 0x86
 * EP1In = 0x81
 */
 /*jshint -W117 */ //ignore missing others files
 /*jshint -W083 */ //ignore create function with loop
var us = require('underscore')
var usb = require("usb")

var USB2000Factory = function() {

	var factory = this

	var _options = {
		VID: 0x2457,
		PID: 0x101E,
		integrationTime: 3000,
		strobleEnableStatus: 0,
		shutdownMode: 0,
		triggerMode: 0
	}


	function USB2000(options) {
		this._internal = {
			claimed: false,
			busy: false
		}

		// this.endpoints = new Endpoints()
		this.funcs = new USB2000Funcs()
		this.spectroData = new USB2000Data(function(){})

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
			//@todo fix this. func.data not getting the right value, only the last one
			if(typeof(USB2000.prototype[func.name]) === 'undefined') {
				var data = func.data
				USB2000.prototype[func.name] = function(callback, extraData) {
					console.log(func.data)
					this.genericFunction(callback, data, extraData)
				}
			}
		}

		this.claim()
	}

	/**
	 * Set the settings of Endpoints
	 */
	USB2000.prototype.configEndPoints = function() {
		var self = this
		var iface = this.iface
		this.EP1In = iface.endpoint(0x81)
		this.EP1Out = iface.endpoint(0x01)
		this.EP2In = iface.endpoint(0x82)

		//spectro data
		this.EP2In.on("data", function(data) {
			self.spectroData.addData(data)
		})

		//all others data
		this.EP1In.on("data", function(data) {
			console.log(data)
			self._internal.busy = false
			if(self.callback !== null)
				self.callback(null, data)
		})
	}

	USB2000.prototype.requestSpectra = function(callback) {
		var self = this
		var func = this.funcs.getByName('requestSpectra')
		var calb = function(error, callback) {
			self._internal.busy = false
			callback(error, data)
		}

		this.spectroData = new USB2000Data(callback)
		this.genericFunction.call(this, calb, func.data)
	}

	USB2000.prototype.setIntegrationTime = function(callback, time) {
		//3s = 3000ms = 300000000us
		//00000000 00101101 11000110 11000000
		//LSW-LSB  LSW-MSB  MSW-LSB  MSW-MSB
		//converted:
		//11000000 11000110 00101101 00000000
		var self = this
		var func = this.funcs.getByName('setIntegrationTime')
		var bin = time.toString(2)
		var bin = this.zeroFill(bin, 32)
		var buffer = new Buffer(4)
		var j = 3
		var joined = []
		for(var i = 0; i < 32; i+=8) {
			var bt = bin.substring(i, i+8)
			buffer[j] = parseInt(bt,2)
			joined[j] = bt
			j--
		}

		this.genericFunction.call(this, null, func.data, buffer)
		callback(null, null)
	}

	USB2000.prototype.zeroFill = function(number, width) {
		width -= number.toString().length;
	 	if (width > 0) {
	    	return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
		}
		return number + ""; // always return a string
	}

	USB2000.prototype.queryStatus = function(callback) {
		var func = this.funcs.getByName('queryStatus')
		var cb = function(error, data) {
			if(error != null) {
				callback(error, data)
				return
			}
			var queryStatus = new USB2000QueryStatus(callback, data)
		}
		this.genericFunction.call(this, cb, func.data)
	}

	/**
	 * Sets the USB2000+ shutdown mode. When shutdown, the internal FX2 microcontroller is
	 * continuously running however all other functionality is disabled. In this power down mode the current
	 * consumption is reduced to 250mA (operating current for the FX2 microcontroller). When shutdown is
	 * active (active low), the external 5V signal (V5_Switched pin 3) is disabled in addition to all other
	 * signals except I2C lines.
	 * Data Byte = 0 => Shutdown everything but the FX2
	 * Data Byte = !0 => Power up entire Spectrometer
	 */

	USB2000.prototype.setShutdownMode = function(callback, status) {
		status = status != null && status != undefined ? status : true

		var buffer = new Buffer(2)
		if(status){
			buffer[0] = 1
			buffer[1] = 0
		}
		else{
			buffer[0] = 0
			buffer[1] = 0
		}
		var func = this.funcs.getByName('setShutdownMode')
		this.genericFunction.call(this, null, func.data, buffer)
		callback(null, null)
	}

	/**
	 * Get the temperature of spectrometer
	 * Temperature (oC) = .003906 * ADC Value
	 * Byte 0 => Read Result
	 * Byte 1 => ADC Value LSB 
	 * Byte 2 => ADC Value MSB
	 */
	USB2000.prototype.readPcbTemperature = function(callback) {
		var func = this.funcs.getByName('readPcbTemperature')
		var cb = function(error, data) {
			if(callback != null)
				callback(error, data)
		}
		this.genericFunction.call(this, cb, func.data)
	}



	/**
	 * Claim for device and start the stream of endpoints
	 */
	USB2000.prototype.claim = function() {
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
	USB2000.prototype.release = function() {
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
	USB2000.prototype.genericFunction = function(callback, data, extraData) {
		if(this._internal.busy){
			var error = "The spectrometer is busy"
			callback(error, null)
			return
		}

		var EP1Out = this.EP1Out
		var buffer = new Buffer(1)
		buffer[0] = data
		if(extraData !== undefined) {
			buffer = Buffer.concat([buffer, extraData], extraData.length + 1)
		}

		if(typeof(callback) === 'function') 
			this.callback = callback
		else
			this.callback = null

		console.log('call', buffer)
		EP1Out.write(buffer)
	}

	factory.USB2000 = USB2000
}

var factory = new USB2000Factory()
module.exports = factory;
	
/**
 * USB2000QueryStatus is used to receive and convert the data of spectros
 * All Spectometer specifications can be found on Oceanoptics site
 * @link http://www.oceanoptics.com/technical/engineering/OEM%20Data%20Sheet%20--%20USB2000+.pdf
 */
function USB2000QueryStatus(callback, data) {
	var output = this.setData(data)
	callback(null, output)
}

/**
 * The data is returned in Binary format and read in by the host through End
 * Point 1 In. The structure for the return information is as follows:
 */
USB2000QueryStatus.prototype.queryStatusList = {
	0: 'Number of pixels',
	2: 'Integration Time',
	6: 'Lamp Enable',
	7: 'Trigger Mode Value',
	8: 'Spectral Acquisition Status',
	9: 'Packets In Spectra',
	10: 'Power Down Flag',
	11: 'Packet Count',
	12: 'Reserved',
	13: 'Reserved',
	14: 'USB Comunications Speed',
	15: 'Reserved'
}

USB2000QueryStatus.prototype.reserved = [12,13,15]

/**
 * Clear cache
 */
USB2000QueryStatus.prototype.clear = function() {
	this.output = []
	this.counter = 0
}

/**
 * Add data to cache
 * All calls is asynchronous and the data has to be merged
 */
USB2000QueryStatus.prototype.setData = function(data) {
	var output = {}
	for(var key in this.queryStatusList) {
		var name = this.queryStatusList[key]
		if(key === '0') 
			output[name] = this.getNumberOfPixels(data)
		else if(key === '2')
			output[name] = this.getIntegrationTime(data)
		else if(this.reserved.indexOf(parseInt(key)) == -1)
			output[name] = data[key]
	}
	this.output = output
	return output
}

USB2000QueryStatus.prototype.getIntegrationTime = function(data) {
	var output = []
	var j = 0
	for(var i = 5; i >= 2; i--){
		output[j] = this.zeroFill(data[i].toString(16),2)
		j++
	}

	var value = output.join('')
	return parseInt(value, 16)
}

USB2000QueryStatus.prototype.getNumberOfPixels = function(data) {
	var output = []
	output[0] = this.zeroFill(data[1].toString(16),2)
	output[1] = this.zeroFill(data[0].toString(16),2)
	var value = output.join('')
	return parseInt(value, 16)
}
console.log(factory.USB2000.prototype);
USB2000QueryStatus.prototype.zeroFill = factory.USB2000.prototype.zeroFill;

/**
 * Return the data output
 */
USB2000QueryStatus.prototype.getData = function() {
	return this.output
}



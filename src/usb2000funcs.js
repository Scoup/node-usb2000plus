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

module.exports = USB2000Funcs
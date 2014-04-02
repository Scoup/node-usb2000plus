# node-usb2000plus

Module to comunicate with Oceanoptics Spectrometer USB2000+

## Getting Started
Install the module with: `npm install usb2000plus`

This module is still in alpha. (do not use in production)

```javascript
var USB2000 = require('usb2000plus').USB2000;
var usb2000plus = new USB2000()
```

With options:
```javascript
var USB2000 = require('usb2000plus').USB2000;
var usb2000 = new USB2000({
	VID: 0x2457,
	PID: 0x101E
})
```
Discovering the PID (product id) and VID (vendor id)

```shell
$ lsusb
```
output:
```shell
Bus 001 Device 006: ID 2457:101e  
```
VID:2457 (hex)
PID:101e (hex)



## Documentation

Require [node-usb](https://github.com/nonolith/node-usb) (already in npm install package)

Tested on Ubuntu 12.04 (x86/arm v7)

First you need permission to run the usb. Copy the file 10-oceanoptics.rules to your /etc/udev/rules.d
```
$ sudo cp 10-oceanoptics.rules /etc/udev/rules.d
```
Without the permission you will need run your node with sudo (*not recommended)

## Examples

### .requestSpectra(callback) - Request spectra data
```javascript
usb2000.requestSpectra(function(data) {
	console.log(data)
})
```

### .queryInformation(callback) - Query Information
```javascript
usb2000.queryInformation(function(data) {
	console.log(data)
})
```

## List of commands
```
intialize()
setIntegrationTime()
setStrobeEnableStatus()
setShutdownMode()
queryInformation()
writeInformation()

requestSpectra()
setTriggerMode()
queryNumberPlugins()
queryPluginIdentifiers()
detectPlugins()

generalICRead()
generalICWrite()
generalSpiIo()
pscoRead()
pscoWrite()
writeRegisterInformation()
readRegisterInformation()
readPcbTemperature()
readIrradianceCalibrationFactors()
writeIrradianceCalibrationFactors()
```

## Building
```shell
$ grunt
```

## Todo List
- Add tests
- Add documentation
- Add some options to customize the data input/output
- Verify all spectrometer functions
- Add busy status while doing query

## Release History
- v0.1 - Started the first release

## License
Copyright (c) 2014 Léo Haddad M. C. Carneiro  
Licensed under the MIT license.

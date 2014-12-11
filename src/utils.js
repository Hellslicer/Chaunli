exports.removeFromObject = function(object, property, value) {
	var done = false;
	try {
		return object.filter(function (item) {
			var skip = false;
			if (!done && item[property] === value) {
				done = true;
				skip = true;
			}
			return (item[property] !== value || (done && !skip));
		});
	} catch (err) {
		console.log("Error on removeFromObject: " + err);
		return object;
	}
};
exports.updateObject = function(objects, property, value, newProperties) {
	try {
		for (var i = 0, length = objects.length; i < length; i++) {
			var object = objects[i];
			if (object[property] == value) {
				Object.keys(newProperties).forEach(function(currentProperty) {
					object[currentProperty] = newProperties[currentProperty];
				});
				break;
			}
		}
	} catch (err) {
		console.log("Error on updateObject: " + err);
	}
	return objects;
};
var rush = require('./../index.js');
var stackParser = require('stack-parser');

var check = function(condition, message) {
	if (condition)
		return;

	if (typeof message === 'undefined')
		message = '';
	else
		message += ' ';

	var where = stackParser.here()[1].format('(%f, line %l)');
	console.log('FAILED: ' + message + where);
};

// Calls cb(err, param). Error is set if param === false.
var asyncAction = function(param, cb) {
	setTimeout(function() {
		if (param !== false)
			cb(null, param);
		else
			cb(new Error('An error in asyncAction() occurred.'));
	}, 0);
};

// Calls cb(param, err). Error is set if param === false.
var weirdAsyncAction = function(param, cb) {
	setTimeout(function() {
		if (param !== false)
			cb(param, null);
		else
			cb(null, new Error('An error in weirdAsyncAction() occurred.'));
	}, 0);
};

rush();

process.exit();





var context = rush({
	value1: 'v1',
	n: 0
})(function() {
	asyncAction(1, this(function(result) {
		check(result === 1);
		this.n++;
	}));

	asyncAction(2, this(function(result) {
		check(result === 2);
		this.n++;
	}));

	check(this.n === 0);
})(function() {
	check(this.n === 2);
})();

try {
	rush();
} catch(e) {
	check(e.message === 'An attempt to execute an empty Rush chain.');
}

check(context.n === 2);

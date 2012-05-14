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
	}, Math.random() * 100 | 0);
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

console.log('Running tests...\n');

try {
	rush();
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'An attempt to execute an too short Rush chain. A chain must have one or more blocks and a finalizer.');
}

try {
	rush(function() {})();
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'An attempt to execute an too short Rush chain. A chain must have one or more blocks and a finalizer.');
}

try {
	rush(function() {})(function(err) {})()();
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'An attempt to execute a Rush chain twice or alter it after execution.');
}

try {
	rush(1);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'Single argument passed to Rush should be either a function or an object.');
}

try {
	rush(function() {}, 1);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'When two arguments are passed to Rush, each of them should be a function.');
}

try {
	rush(1, function() {});
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'When two arguments are passed to Rush, each of them should be a function.');
}

try {
	rush(1, 1);
} catch(err) {
	check(err instanceof TypeError);
	check(err.message === 'When two arguments are passed to Rush, each of them should be a function.');
}

try {
	rush(1, 1, 1);
} catch(err) {
	check(err instanceof Error);
	check(err.message === 'Invalid number of arguments passed to Rush.');
}

rush({ x: 2, y: 3 })(function() {
	check(this.x === 2);
	check(this.y === 3);
})(function(err) {
	check(!err);
})();

var finalizerCalled = false;

rush(function() {
//	try {
//		this();
//	} catch(err) {
//		check(err instanceof TypeError);
//		check(err.message === 'A callback function should be passed.');
//	}
//
//	try {
//		this(1);
//	} catch(err) {
//		check(err instanceof TypeError);
//		check(err.message === 'A callback passed to be wrapped should be a function.');
//	}
//
//	try {
//		this(function() {}, 1);
//	} catch(err) {
//		check(err instanceof TypeError);
//		check(err.message === 'An error handler passed with the callback should be a function.');
//	}

	var f = this(function() {}, function(err) {});
	f(); // Otherwise Rush will freeze.
})(function(err) {
	check(!err);
	finalizerCalled = true;
})();

check(finalizerCalled);

rush({
	value1: 'v1',
	n: 0
})(function() {
	check(this.value1 === 'v1');

	asyncAction(1, this(function(result) {
		console.log('a');
		check(result === 1);
		this.n++;
	}));

	asyncAction(2, this(function(result) {
		console.log('b');
		check(result === 2);
		this.n++;
	}));

	check(this.n === 0);
})(function(err) {
	check(!err);
	check(this.n === 2);
	console.log('Finalizer called.');
})();

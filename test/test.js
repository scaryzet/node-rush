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

var finalizers = {};

rush(function() {
	try {
		this();
	} catch(err) {
		check(err instanceof TypeError);
		check(err.message === 'A callback function should be passed.');
	}

	try {
		this(1);
	} catch(err) {
		check(err instanceof TypeError);
		check(err.message === 'A callback passed to be wrapped should be a function.');
	}

	try {
		this(function() {}, 1);
	} catch(err) {
		check(err instanceof TypeError);
		check(err.message === 'An error handler passed with the callback should be a function.');
	}

	var f = this(function() {}, function(err) {});
	f(); // Otherwise the finalizer won't be called.
})(function(err) {
	check(!err);
	finalizers.a = true;
})();

rush({
	value1: 'v1',
	n: 100
})(function() {
	check(this.value1 === 'v1');

	asyncAction(1, this(function(result) {
		check(result === 1);
		this.n++;
	}));

	asyncAction(2, this(function(result) {
		check(result === 2);
		this.n++;
	}));

	asyncAction(3, this(function(result) {
		check(result === 3);
		this.n++;
	}));

	check(this.n === 100);
})(function(err) {
	finalizers.b = true;
	check(!err);
	check(this.value1 === 'v1');
	check(this.n === 103);
})();

rush({
	n: 1
})(function() {
	this.n++;
})(function() {
	this.n++;
})(function(err) {
	finalizers.d = true;
	check(!err);
	check(this.n === 3);
})();

rush(function() {
	this.n = 1;
	asyncAction(3, this(function(result) {
		check(result === 3);
		this.n++;
	}));
})(function() {
	this.n++;
})(function() {
	this.n++;
	asyncAction(3, this(function(result) {
		check(result === 3);
		this.n++;
	}));
})(function() {
	this.n++;
})(function(err) {
	finalizers.e = true;
	check(!err);
	check(this.n === 6);
})();

// Test exceptions.

rush(function() {
	throw new Error('Test exception.');
})(function(err) {
	finalizers.a1 = true;
	check(err instanceof Error);
	check(err && err.message === 'Test exception.');
})();

// Check task failing and sealing of callbacks.
rush(function() {
	this.n = 1;

	setTimeout(this(function() {
		this.n++;
		throw new Error('Test exception.');
	}), 100);

	setTimeout(this(function() {
		this.n++;
	}), 500);

	setTimeout(this(function() {
		this.n++;
	}), 500);
})(function() {
	this.n++;
})(function(err) {
	finalizers.a2 = true;
	check(err && err.message === 'Test exception.');
	check(this.n === 2);
})();

// Test task error handler suppressing errors.

rush(function() {
	this.n = 1;

	asyncAction(false, this(function() {
		this.n++; // This should not be called.
	}, function(err) {
		check(err && err.message === 'An error in asyncAction() occurred.');
		this.e = 1;
	}));
})(function() {
	this.n2 = 1;
})(function(err) {
	finalizers.a3 = true;
	check(!err);
	check(this.n === 1);
	check(this.e === 1);
	check(this.n2 === 1);
})();

// Check task error handler throwing.

rush(function() {
	this.n = 1;

	asyncAction(false, this(function() {
		this.n++; // This should not be called.
	}, function(err) {
		throw new Error('Another error.');
	}));
})(function() {
	this.n2 = 1;
})(function(err) {
	finalizers.a4 = true;
	check(err)
	check(err && err.message === 'Another error.');
	check(this.n === 1);
	check(this.n2 !== 1);
})();

setTimeout(function() {
	check(finalizers.a);
	check(finalizers.b);
	check(finalizers.d);
	check(finalizers.e);

	check(finalizers.a1);
	check(finalizers.a2);
	check(finalizers.a3);
	check(finalizers.a4);

	console.log('\nTesting completed.');
}, 2000);

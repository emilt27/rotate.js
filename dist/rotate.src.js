;
(function(w) {
    "use strict";

    var EVENT_ROTATE_START = 'rotate.start';
    var EVENT_ROTATE = 'rotate.progress';
    var EVENT_ROTATE_STOP = 'rotate.stop';
    var EVENT_CHANGE_DIRECTION = 'rotate.changeDirection';

    var LINEAR_TRANSITION = 'linear';

    var requestAnimFrame = (function(window) {
        return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })(w);

    var extend = function(obj) {
        var length = arguments.length;

        if (length < 2) {
            return obj || {};
        }

        for (var index = 1; index < length; index++) {
            var source = arguments[index];
            var keys = Object.keys(source);
            var l = keys.length;

            for (var i = 0; i < l; i++) {
                var key = keys[i];

                obj[key] = source[key];
            }
        }
        return obj;
    };

    var defaults = {
        cx: 0,
        cy: 0,
        angle: 0,
        speed: 0,
        inertia: 0,
        minimalSpeed: 0.001,
        minimalAngleChange: 0.1,
        step: 0,
        stepTransitionTime: 0,
        stepTransitionEasing: LINEAR_TRANSITION
    };

    var RotateJS = function(options) {
        this.init(options);
    };

    RotateJS.prototype = {
        options: defaults,

        init: function(options) {
            this.options = extend({}, this.options, options);
            this.eventHandlers = [];

            this._initState();
            this._bindHandlers();
            this._update();
        },

        onRotationStart: function() {
            this.state.active = true;
            this.state.speed = 0;
            this.state.lastMouseAngle = undefined;
            this.state.lastElementAngle = undefined;
            this.state.lastMouseEvent = undefined;

            this.trigger(EVENT_ROTATE_START, this.state);
        },

        onRotated: function(event) {
            if (this.state.active === true) {
                if (typeof event.targetTouches !== 'undefined' && typeof event.targetTouches[0] !== 'undefined') {
                    this.state.lastMouseEvent = {
                        pageX: event.targetTouches[0].pageX,
                        pageY: event.targetTouches[0].pageY
                    };
                } else {
                    this.state.lastMouseEvent = {
                        pageX: event.pageX || event.clientX,
                        pageY: event.pageY || event.clientY
                    };
                }
            }
        },

        onRotationStop: function() {
            this.state.active = false;
            this.trigger(EVENT_ROTATE_STOP, this.state);
        },

        trigger: function(event, data) {
            this.eventHandlers
                .filter(function(h) {
                    return h.event === event;
                })
                .forEach(function(h) {
                    h.callback.call(h.context || this, data);
                });
        },

        on: function(event, callback, context) {
            this.eventHandlers.push({
                event: event,
                callback: callback,
                context: context
            });
        },

        off: function(event, callback, context) {
            this.eventHandlers = this.eventHandlers.filter(function(handler) {
                return !(event === handler.event && callback === handler.callback && context === handler.context);
            });
        },

        _bindHandlers: function() {
            this._update = this._update.bind(this);
            this.onRotationStart = this.onRotationStart.bind(this);
            this.onRotated = this.onRotated.bind(this);
            this.onRotationStop = this.onRotationStop.bind(this);
        },

        _triggerOnRotate: function(rotateAngle) {
            const direction = rotateAngle !== 0 && rotateAngle > 0 ? 1 : -1 || 0;

            if (this.state.direction !== direction) {
                this.trigger(EVENT_CHANGE_DIRECTION, direction);
            }

            this.trigger(EVENT_ROTATE, this.state);
        },

        _initState: function() {
            var me = this;
            var opts = me.options;

            me.state = {
                cx: opts.cx,
                cy: opts.cy,
                active: false,
                transiting: false,
                step: opts.step || defaults.step,
                stepTransitionTime: opts.stepTransitionTime || defaults.stepTransitionTime,
                stepTransitionEasing: opts.stepTransitionEasing || defaults.stepTransitionEasing,
                speed: opts.speed || defaults.speed,
                inertia: opts.inertia || defaults.inertia,
                minimalSpeed: opts.inertia || defaults.inertia,
                lastAppliedAngle: null,
                minimalAngleChange: null,

                get angle() {
                    return this._angle;
                },

                set angle(value) {
                    this._angle = value;
                    this.virtualAngle = value;
                    me._triggerOnRotate(value);
                }
            };

            me.state.angle = opts.angle || defaults.angle;
            me.state.lastAppliedAngle = me.state.virtualAngle = me.state._angle = opts.angle || defaults.angle;
            me.state.minimalAngleChange = me.state.step !== defaults.step ? me.state.step : defaults.minimalAngleChange;
        },

        _update: function() {
            // Calculating angle on requestAnimationFrame only for optimisation purposes
            if (typeof this.state.lastMouseEvent !== 'undefined' && this.state.active === true) {
                this._updateAngleToMouse(this.state.lastMouseEvent);
            }

            this._updateAngle();
            this._applySpeed();
            this._applyInertia();

            const angleDiff = this.state.lastAppliedAngle - this.state._angle;

            if (Math.abs(angleDiff) >= this.state.minimalAngleChange && this.state.transiting === false) {
                this._triggerOnRotate(angleDiff);

                // Prevents new transition before old is completed
                this._blockTransition();
                this.trigger(EVENT_ROTATE, this.state);

                this.state.lastAppliedAngle = this.state._angle;
            }

            requestAnimFrame(this._update);
        },

        _updateAngleToMouse: function(event) {
            var xDiff = event.pageX - this.state.cx;
            var yDiff = event.pageY - this.state.cy;

            var mouseRadians = Math.atan2(xDiff, yDiff);
            var mouseDegrees = mouseRadians * (180 / Math.PI * -1) + 180;

            if (this.state.lastMouseAngle === undefined) {
                this.state.lastElementAngle = this.state.virtualAngle;
                this.state.lastMouseAngle = mouseDegrees;
            }

            if (this.state.stepTransitionTime !== defaults.stepTransitionTime) {
                this.state.speed = this.state.mouseDiff = this._differenceBetweenAngles(mouseDegrees, this.state.lastMouseAngle);
                this.state.virtualAngle = this.state.lastElementAngle + this.state.mouseDiff;
                this.state.lastElementAngle = this.state.virtualAngle;
                this.state.lastMouseAngle = mouseDegrees;
            } else {
                var oldAngle = this.state.virtualAngle;

                this.state.mouseDiff = mouseDegrees - this.state.lastMouseAngle;
                this.state.virtualAngle = this.state.lastElementAngle + this.state.mouseDiff;

                var newAngle = this.state.virtualAngle;

                this.state.speed = this._differenceBetweenAngles(newAngle, oldAngle);
            }
        },

        _differenceBetweenAngles: function(newAngle, oldAngle) {
            var a1 = newAngle * (Math.PI / 180);
            var a2 = oldAngle * (Math.PI / 180);
            var radians = Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2));
            var degrees = radians * (180 / Math.PI);

            return Math.round(degrees * 100) / 100;
        },

        _updateAngle: function() {
            if (this.state.step > 0) {
                this.state._angle = this._getAngleFromVirtual();
            } else {
                this.state._angle = this._normalizeAngle(this.state.virtualAngle);
            }
        },

        _getAngleFromVirtual: function() {
            return Math.ceil(this.state.virtualAngle / this.state.step) * this.state.step;
        },

        _normalizeAngle: function(angle) {
            var result = angle % 360;

            if (result < 0) {
                result = 360 + result;
            }
            return result;
        },

        _applySpeed: function() {
            if (this.state.inertia > 0 && this.state.speed !== 0 && this.state.active === false) {
                this.state.virtualAngle += this.state.speed;
            }
        },

        _applyInertia: function() {
            if (this.state.inertia > 0) {
                if (Math.abs(this.state.speed) >= this.state.minimalSpeed) {
                    this.state.speed = this.state.speed * this.state.inertia;

                    // Execute onStop callback if stopped
                    if (this.state.active === false && Math.abs(this.state.speed) < this.state.minimalSpeed) {
                        this.trigger(EVENT_ROTATE_STOP, this.state);
                    }
                } else if (this.state.speed !== 0) {
                    this.state.speed = 0;
                }
            }
        },

        _blockTransition: function() {
            if (this.state.stepTransitionTime !== defaults.stepTransitionTime) {
                var me = this;

                setTimeout(function() {
                    me.state.transiting = false;
                }, me.state.stepTransitionTime);

                me.state.transiting = true;
            }
        }
    };

    w.RotateJS = RotateJS;
})(window);
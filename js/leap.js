////////////////////////////////////////////
//
// Configuration
//
////////////////////////////////////////////

  var options = {
    // Threshold velocities to trigger gestures
    // Lower = more sensitive
    xThreshold: 600,
    yThreshold: 1000,
    zThreshold: 1300
  };


////////////////////////////////////////////
//
// Hands
//
////////////////////////////////////////////

  var hands = [];
  var HandModel = function() {
    var hand = this;
    this.el = null;
    this.properties = {};

    this.isGesturing = false;
    this.timers = {
      start: null,
      compound: null
    };

    this.gestures = [];

    this.init = function() {
      this.el = document.createElement('div');
      this.el.className = 'sprite';
      document.body.appendChild(this.el);
    };
    this.init();

    this.frame = function(properties) {
      this.properties = properties;
      this.setTransform();
      this.detectGestures();
    };

    this.setTransform = function() {
      var pos = this.properties.screenPosition();
      this.el.style.left = pos[0] - 10 + 'px';
      this.el.style.top  = pos[1] - 10 + 'px';
      this.el.style.transform = 'rotate(' + -this.properties.roll() + 'rad)';
    };

    // Detect intentional movements and interpet
    // them as specific directional gestures
    this.detectGestures = function() {
      var v = this.properties.palmVelocity;
      var intent = {
        left  : v[0] / -options.xThreshold,
        right : v[0] /  options.xThreshold,

        down  : v[1] / -options.yThreshold,
        up    : v[1] /  options.yThreshold,

        far   : v[2] / -options.zThreshold,
        near  : v[2] /  options.zThreshold
      };

      var ret = [];
      for (direction in intent) {
        if (intent[direction] >= 1) ret.push(direction);
      }

      // This is a little weird to follow, but what's happening
      // here is that when an intentional movement is detected
      // (i.e., the speed you move your hand in one direction
      // meets a certain value), it triggers an event. We only want
      // the event to trigger once, so there's a slight delay after
      // the event ends for when another is allowed to fire.
      //
      // BUT! To allow for a gesture that occurs on more than
      // one axis (like moving from top-left to bottom-right),
      // there's a slight delay before the event fires so that
      // more than one movement direction can trigger this. Just
      // trust that it works. Hopefully.
      if (ret.length > 0 && !this.isGesturing) {
        clearTimeout(this.timers.start);
        this.timers.start = setTimeout(function() {
          hand.isGesturing = true;
          for (i in ret) {
            gestures.trigger(ret[i], hand.properties, ret, intent);
            hand.addCompoundGesture(ret[i], hand.properties, intent);
          }
          setTimeout(function() {
            hand.isGesturing = false;
          }, 200);
        }, 10);
      }
    };

    // Compound gestures. Allow each hand to independently
    // have its own series of gestures.
    this.addCompoundGesture = function(gesture, h, intent) {
      this.gestures.push({
        gesture: gesture,
        hand:    h,
        intent:  intent
      });
      if (this.gestures.length > 1) this.triggerCompoundGestures();
      clearTimeout(this.timers.compound);
      this.timers.compound = setTimeout(function() {
        hand.resetCompoundGestures();
      }, 700);
    };

    this.triggerCompoundGestures = function() {
      var gestureArray = [];
      for (i in this.gestures) {
        gestureArray.push(this.gestures[i].gesture);
      }
      gestures.trigger(gestureArray.join('-'), this.gestures);
    };

    this.resetCompoundGestures = function() {
      this.gestures = [];
    };
  };


////////////////////////////////////////////
//
// Leap Motion Controller Interface
//
////////////////////////////////////////////

  var controller = Leap.loop({enableGestures: true}, function(frame){
    frame.hands.forEach(function(properties, index) {

      var hand = ( hands[index] || (hands[index] = new HandModel()) );
      hand.frame(properties);

    });
  }).use('screenPosition');

  controller.setBackground('true');


////////////////////////////////////////////
//
// Gesture Event Binding
//
////////////////////////////////////////////

  var gestures = {
    functions: {},

    bind: function(gestureStr, fn) {
      gestureStr = gestureStr.split(',');
      for (i in gestureStr) {
        var gesture = gestureStr[i];
        if (!this.functions[gesture]) this.functions[gesture] = [];
        this.functions[gesture].push(fn);
      }
    },

    trigger: function(gestureStr) {
      var args = Array.prototype.slice.call(arguments);
      args.shift();
      gestureStr = gestureStr.split(',');
      for (i in gestureStr) {
        var gesture = gestureStr[i];
        console.log(gesture);
        if (!this.functions[gesture]) return;
        for (j in this.functions[gesture]) {
          this.functions[gesture][j].apply(null, args);
        }
      }
    }
  };


////////////////////////////////////////////
//
// Singular Gesture Examples
//
////////////////////////////////////////////

  gestures.bind('down', function(hand, intent) {
    if (hand.roll() > 1 || hand.roll() < -1) {
      console.log('KARATE CHOP!!');
    } else {
      console.log('HULK SLAM');
    }
  });

  gestures.bind('up', function(hand, intent) {
    if (hand.pinchStrength > .80) {
      console.log('oh just buyin some tickets');
    }
  });

  gestures.bind('left-right-left,right-left-right', function(hand) {
    console.log('bitch slaaaaap');
  });


////////////////////////////////////////////
//
// Compound Gestures Examples
//
// Because multiple gestures are involved,
// the arguments are different.
//
////////////////////////////////////////////

  gestures.bind('far-near', function(gestures) {
    if (gestures[0].hand.grabStrength > .80) {
      console.log('HULK SMASH');
    }
  });

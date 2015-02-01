'use strict';

var World = function() {};

World.prototype.init = function() {
    this.state = 'idle';

    this.renderer = this.init_renderer();
    this.scene    = this.init_scene();
    this.camera   = this.init_camera();
    this.lights   = this.init_lights();

    this.raycaster   = new THREE.Raycaster();
    this.intersected = null;
    this.mouse = new THREE.Vector2();

    this.boids = new Boids();
    this.boids.init(this.scene);
    this.build_title();

    this.oak = new Oak();
    this.oak.init(this.scene);

    this.vr_effect     = new THREE.VREffect( this.renderer );
    this.vr_controls   = new THREE.VRControls( this.camera );
    this.mono_controls = new THREE.OrbitControls( this.camera );

    this.change_mode("mono");

    this.animation_speed = 1.0;

    this.load_geo();
    this.load_listings();

    this.bind_events();

    this.high_res = true; // render row-level data
    this.show_seatview = false;
    this.show_reverse  = false;
    this.selected_seatview = null;
    this.selected_section_index = 1;

    this.state = 'start';

    requestAnimationFrame(this.render.bind(this));
};

World.prototype.load_geo = function() {
    var that = this;
    $.getJSON("data/yankees_geo.json", function(data) {
        that.geo_data = data;
        that.process_mapdata();
    });
};

World.prototype.load_listings = function() {
    var that = this;
    $.getJSON("data/yankees_listings.json", function(data) {
        that.listings_data = data;
        that.process_mapdata();
    });
};

World.prototype.get_section_name_from_mk = function(mk) {
    var re = /^s:((?:\w|-)+)/;
    var section_name = re.exec(mk)[1];
    return section_name;
};

World.prototype.process_mapdata = function() {
    if (!this.geo_data || !this.listings_data) {
        return;
    }
    this.mapdata = {};
    this.sorted_mapdata = [];

    var sections = this.geo_data.sections;

    for (var section_name in sections) {
        var section = sections[section_name];
        this.mapdata[section_name] = {
            center : section.center,
            points : section.points[0],
            listings: [],
            type: 'section',
            rows: []
        }
        for (var row_name in section.rows) {
            var row = section.rows[row_name];
            this.mapdata[section_name].rows.push({
                center : row.center,
                points : row.points[0],
                listings: [],
                type: 'row'
            });
        }
    }

    for (var i = 0; i < this.listings_data.listings.length; i++) {
        var listing = this.listings_data.listings[i];
        if (listing.mk) {
            var section_name = this.get_section_name_from_mk(listing.mk);

            if (!this.mapdata[section_name]) { continue; };

            this.mapdata[section_name].listings.push({
                dq_bucket : listing.b,
                dq : listing.dq
            });

            if (!this.mapdata[section_name].max_dq || listing.dq > this.mapdata[section_name].max_dq) {
                this.mapdata[section_name].max_dq = listing.dq;
                this.mapdata[section_name].max_dq_bucket = listing.b;
                this.mapdata[section_name].max_dq_price = listing.pf;
            }
        };
    }

    for (var seatview_name in this.listings_data.seatviews["2048"]) {
        if (this.mapdata[seatview_name]) {
            this.mapdata[seatview_name].seatview = this.listings_data.seatviews["2048"][seatview_name];
            this.mapdata[seatview_name].dq_index = this.sorted_mapdata.length;
            this.sorted_mapdata.push(this.mapdata[seatview_name]);
        }
    }

    this.sorted_mapdata.sort(function(a, b) {
        if (!b.max_dq) return -1;
        if (!a.max_dq) return  1;
        return b.max_dq - a.max_dq;
    });

    this.build_stadium();
};

World.prototype.change_mode = function (mode) {
    console.log('changing mode: ' + mode);
    switch(mode) {
        case 'mono':
            this.effect = this.renderer;
            this.controls = this.mono_controls;
            break;
        case 'vr':
            this.controls = this.vr_controls;
            this.effect = this.vr_effect;
            break;
    }
    this.effect.setSize( window.innerWidth, window.innerHeight );
};

World.prototype.enter_vr = function () {
    if(!window.frameElement) {
        this.controls = this.vr_controls;
        this.effect = this.vr_effect;
        this.effect.setFullScreen( true );
    }
};

function handle_fs_change(e) {
  var fullscreenElement = document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement;

  if (fullscreenElement == null) {
    this.effect = this.renderer;
    this.controls = this.mono_controls;
  }
};

World.prototype.bind_events = function() {
    var that = this;

    $(document).on('keypress', function(e) {
        console.log(e);
        if (e.keyCode == 37) { // left
            that.go_to_previous_deal();
        } else if (e.keyCode == 39) { // right
            that.go_to_next_deal();
        } else if (e.keyCode == 38) { // up
            e.preventDefault();
            if (that.show_seatview == true) {
                that.show_seatview = false;
                that.remove_seatview();
            } else {
                that.show_seatview = true;
                that.display_seatview();
            }
        } else if (e.keyCode == 40) { // down
            e.preventDefault();
            if (that.state_locked) return;
            that.show_reverse = !that.show_reverse;
            that.state = 'jump-to-section';
        } else if (e.keyCode == 13) { // enter
            that.remove_label();
            that.state = "oak";
        } else if (e.keyCode == 27) { // escape
            if (that.state_locked) return;
            that.remove_label();
            that.show_seatview = false;
            that.show_reverse = false;
            that.remove_seatview();
            that.state = 'overhead-idle';
        }
    });

    $(document).on('mousemove', function(e) {
        that.mouse.x =   ( e.clientX / window.innerWidth  ) * 2 - 1;
        that.mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
    });

    $(document).on('click', function(e) {
        if (that.state_locked == true) return;
        console.log(that.intersected);
        if (that.intersected) {
            that.selected_section = that.mapdata[that.intersected.section_name];
            that.state = 'jump-to-section';
            // if (that.mapdata[that.intersected.section_name].dq_index) {
            //     var index = that.mapdata[that.intersected.section_name].dq_index;
            //     that.selected_section_index = index; // this is broken
            //     that.state = 'jump-to-section';
            // }
        }
    })

    gestures.bind('left', function() {
        that.go_to_previous_deal();
    });
    gestures.bind('right', function() {
        that.go_to_next_deal();
    });
};

World.prototype.go_to_previous_deal = function() {
    if (this.state_locked == true) return;
    this.selected_section_index--;
    if (this.selected_section_index < 0) {
        this.selected_section_index = this.sorted_mapdata.length - 1;
    }
    this.selected_section = this.sorted_mapdata[this.selected_section_index];
    this.state = 'jump-to-section';
};

World.prototype.go_to_next_deal = function() {
    if (this.state_locked == true) return;
    this.selected_section_index++;
    if (this.selected_section_index > this.sorted_mapdata.length - 1) {
        this.selected_section_index = 0;
    }
    this.selected_section = this.sorted_mapdata[this.selected_section_index];
    this.state = 'jump-to-section';
};


World.prototype.init_renderer = function() {
    var renderer =  new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.autoClear = false;
    renderer.setClearColor( 0xFF0000 );
    document.body.appendChild(renderer.domElement);
    return renderer;
};

World.prototype.onWindowResize = function() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( window.innerWidth, window.innerHeight );
};

World.prototype.init_scene = function() {
    var scene = new THREE.Scene({ fixedTimeStep: 1 / 120 });
    scene.fog = new THREE.Fog( 0xffffff, 1, 7000 );
    scene.fog.color.setHSL( 0.6, 0, 1 );
    return scene;
};

World.prototype.init_lights = function() {
    var lights = [];
    var hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.25 );
    hemiLight.color.setHex( 0x91BBFF );
    hemiLight.groundColor.setHex( 0xD4FFD5 );
    hemiLight.position.set( 0, 1000, 0 );

    this.scene.add( hemiLight );

    var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.color.setHex( 0xFFFBF3 );
    dirLight.position.set( -1, 1.75, 1 );
    dirLight.position.multiplyScalar( 1000 );


    dirLight.castShadow = true;

    dirLight.shadowMapWidth = 2048;
    dirLight.shadowMapHeight = 2048;
    this.scene.add( dirLight );

    var vertexShader = document.getElementById( 'vertexShader' ).textContent;
    var fragmentShader = document.getElementById( 'fragmentShader' ).textContent;
    var uniforms = {
        topColor:    { type: "c", value: new THREE.Color( 0x0077ff ) },
        bottomColor: { type: "c", value: new THREE.Color( 0xffffff ) },
        offset:      { type: "f", value: 33 },
        exponent:    { type: "f", value: 0.6 }
    }
    uniforms.topColor.value.copy( hemiLight.color );

    this.scene.fog.color.copy( uniforms.bottomColor.value );

    var skyGeo = new THREE.SphereGeometry( 4000, 32, 15 );
    var skyMat = new THREE.ShaderMaterial( { vertexShader: vertexShader, fragmentShader: fragmentShader, uniforms: uniforms, side: THREE.BackSide } );

    var sky = new THREE.Mesh( skyGeo, skyMat );
    this.scene.add( sky );

    return lights;
};

World.prototype.init_camera = function() {
    console.log('init camera');
    var WIDTH = window.innerWidth,
        HEIGHT = window.innerHeight;

    var VIEW_ANGLE = 75,
        ASPECT = WIDTH / HEIGHT,
        NEAR = 0.1,
        FAR = 10000;
    var camera = new THREE.PerspectiveCamera(  VIEW_ANGLE,
                                ASPECT,
                                NEAR,
                                FAR  );

    camera.position.set( 0, 0, 0);

    this.dolly = new THREE.Group();
    this.dolly.rotateX(Math.PI/2);
    this.dolly.add(camera);

    this.scene.add(this.dolly);

    return camera;
};


////////////////////////////////////////////
//
// Process data
//
////////////////////////////////////////////

World.prototype.color_for_bucket = function(bucket) {
    var colors = [
        "#518202",
        "#609d0d",
        "#91b308",
        "#ed860c",
        "#f64f06",
        "#e40909",
        "#2378c5"
    ];
    return colors[bucket];
};

World.prototype.build_stadium =  function () {
    var that = this;
    this.stadium_group = new THREE.Object3D();

    for (var section_name in this.mapdata) {
        var section = this.mapdata[section_name];
        var building_material = new THREE.MeshPhongMaterial({
            color: this.color_for_bucket(section.max_dq_bucket),
        });

        var full_shape,
            distance = Math.sqrt((this.geo_data.center[0] - section.center[0])*(this.geo_data.center[0] - section.center[0]) + (this.geo_data.center[1] - section.center[1])*(this.geo_data.center[1] - section.center[1]));

        if (this.high_res) {
            full_shape = new THREE.Geometry();
            if (section.rows.length == 0) continue;
            for (i in section.rows) {
                var row = section.rows[i];
                var row_shape = this.convert_shape(row.points);
                var row_distance = Math.sqrt((this.geo_data.center[0] - row.center[0])*(this.geo_data.center[0] - row.center[0]) + (this.geo_data.center[1] - row.center[1])*(this.geo_data.center[1] - section.center[1]));

                var geometry = row_shape.extrude({
                    amount: Math.pow(row_distance/200, 3),
                    bevelEnabled: false
                });
                full_shape.merge(geometry);
            }
        } else {
            var shape = this.convert_shape(section.points);
            full_shape = shape.extrude({
                amount: Math.pow(distance/200, 3),
                bevelEnabled: false
            });
        }

        var object = new THREE.Mesh(full_shape, building_material);
        this.stadium_group.add(object);

        section.position = new THREE.Vector3(
            (section.center[0] - 500)/10,
            (500 - section.center[1])/10,
            Math.pow(distance/200, 3)
        );
        section.object = object;
        section.object.section_name = section_name;
        section.name = section_name;
    }

    var url = "yankees_field.png";
    var texture = THREE.ImageUtils.loadTexture( url, null, function(tex) {
        var fieldMaterial = new THREE.MeshBasicMaterial( {map : tex, transparent: true} );
        var geometry = new THREE.PlaneBufferGeometry( 44, 44, 20 );
        var plane = new THREE.Mesh( geometry, fieldMaterial );
        plane.position.y = 7;
        that.scene.add(plane);

        that.scene.add(that.stadium_group);
        that.state = 'start';
    });
};

World.prototype.convert_shape = function (input_points) {
    var pts = [];
    for (var i = 0; i < input_points.length; i++) {
        pts.push(new THREE.Vector2((input_points[i][0]-500)/10, (500 - input_points[i][1])/10));
    }
    var shape = new THREE.Shape();
    shape.fromPoints(pts);
    return shape;
},


////////////////////////////////////////////
//
// Render the scene
//
////////////////////////////////////////////

World.prototype.render = function(time) {
    requestAnimationFrame( this.render.bind(this) );

    TWEEN.update(time);

    if (typeof this.controls.update == 'function') {
        this.controls.update();
    }
    this.handle_state(time);

    this.boids.render();

    if (this.stadium_group) {
        this.raycaster.ray.origin.copy(this.dolly.position);
        this.raycaster.ray.direction.set(this.mouse.x, this.mouse.y, 0.5).unproject(this.camera).sub(this.dolly.position).normalize();

        var intersects = this.raycaster.intersectObjects( this.stadium_group.children );
        if ( intersects.length > 0 ) {
            if ( this.intersected != intersects[ 0 ].object ) {
                if ( this.intersected ) this.intersected.material.emissive.setHex( this.intersected.currentHex );

                this.intersected = intersects[ 0 ].object;
                this.intersected.currentHex = this.intersected.material.emissive.getHex();
                this.intersected.material.emissive.setHex( 0x0000ff );
            }
        } else {
            if ( this.intersected ) this.intersected.material.emissive.setHex( this.intersected.currentHex );
            this.intersected = null;
        }
    }

    this.effect.render( this.scene, this.camera );
};


////////////////////////////////////////////
//
// Section Labels
//
////////////////////////////////////////////

World.prototype.build_title =  function () {
    var geometry = new THREE.TextGeometry("SEATGEEK VR", {size: 50, height: 5, font: "helvetiker", weight: "bold"});
    var material = new THREE.MeshNormalMaterial();

    var object = new THREE.Mesh(geometry, material);

    object.rotation.x = Math.PI/2

    object.position.x = -250;
    object.position.y = -700;
    object.position.z = 10;

    this.text_object = object;

    this.scene.add(object);
};

World.prototype.build_label = function (label) {
    var that = this;
    this.remove_label(function() {
        label = label.replace(/-/g, ' ');
        label = label.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); })
        var geometry = new THREE.TextGeometry(label, {
            size: .15,
            height: .02,
            font: 'helvetiker',
            weight: 'bold'
        });
        var material = new THREE.MeshBasicMaterial({
            opacity: 0,
            transparent: true
        });
        var object = new THREE.Mesh(geometry, material);
        object.position.z = -2.8;
        object.position.y = -1.9;
        object.position.x = -2.2;

        var tween = new TWEEN.Tween(material)
            .to({opacity : 1}, 500)
            .start();

        that.label = object;
        that.dolly.add(that.label);
    })

};

World.prototype.remove_label = function (fn) {
    if (!fn) fn = function() {};
    var that = this;
    if (this.label) {
        var tween = new TWEEN.Tween(this.label.material)
            .to({opacity : 0}, 500)
            .start()
            .onComplete(function() {
                that.dolly.remove(that.label);
                fn.call(that);
            });
    } else {
        fn.call(this);
    }
};


////////////////////////////////////////////
//
// Seat Views
//
////////////////////////////////////////////

World.prototype.display_seatview = function() {
    var that = this;
    this.remove_seatview(function() {
        if (!that.show_seatview) return;
        if (!that.selected_section.seatview) return;
        var geometry = new THREE.PlaneBufferGeometry( 6.4, 4.8, 5 );
        var split = that.selected_section.name.split('-');
        var key = split[split.length - 1];
        if (key.length == 1) key = split[split.length - 2] + key;
        var url = "/img/" + key + '.jpg';
        var texture = THREE.ImageUtils.loadTexture( url );

        var material = new THREE.MeshBasicMaterial({
            map: texture,
            opacity: 0,
            transparent: true
        });

        var plane = new THREE.Mesh( geometry, material );
        plane.position.z = -4;

        var tween = new TWEEN.Tween(
            material
        ).to(
            {opacity : 0.95},
            500
        ).start().onComplete(function() {
            that.selected_seatview = plane;
        });

        that.dolly.add( plane );
    });
};

World.prototype.remove_seatview = function(fn) {
    if (!fn) fn = function() {};
    var that = this;
    if (this.selected_seatview) {
        var seatview = this.selected_seatview;
        var tween = new TWEEN.Tween(
            seatview.material
        ).to(
            {opacity : 0},
            500
        ).start().onComplete(function() {
            that.dolly.remove(seatview);
            fn.call(that);
        });
    } else {
        fn.call(this);
    }
}


////////////////////////////////////////////
//
// Camera State Management
//
////////////////////////////////////////////

World.prototype.handle_state = function(time) {
    var that = this;
    if (this.state_locked) return;
    if (this.state == "start") {
        this.dolly.position.set(0, -1200, 50);
        this.state = "title"
    }
    if (this.state == "title") {
        this.state_locked = true;
        this.tween = new TWEEN.Tween(this.dolly.position)
            .to({
                x: 0,
                y: 0,
                z: 200
            }, 4000*this.animation_speed)
            .easing( TWEEN.Easing.Cubic.InOut )
            .delay(4000)
            .start()
            .onComplete(function() {
                that.state = "overhead";
                that.state_locked = false;
            });

        var tween = new TWEEN.Tween(this.dolly.rotation)
            .to({x : 0}, 4000*this.animation_speed)
            .easing( TWEEN.Easing.Cubic.InOut )
            .delay(4000)
            .start();
    }
    if (this.state == "overhead") {
        if (this.state_locked) {
            return;
        }
        this.state_locked = true;
        this.tween = new TWEEN.Tween(this.dolly.position)
            .to({
                x: 0,
                y: 0,
                z: 100
            }, 1000*this.animation_speed)
            .easing( TWEEN.Easing.Cubic.InOut )
            .start()
            .onComplete(function() {
                that.selected_section = that.sorted_mapdata[1];
                that.state = "jump-to-section";
                that.state_locked = false;
            });
    }
    if (this.state == "overhead-idle") {
        if (this.state_locked) return;
        this.state_locked = true;
        this.tween = new TWEEN.Tween(this.dolly.position)
            .to({
                x: 0,
                y: 0,
                z: 100
            }, 1000*this.animation_speed)
            .easing( TWEEN.Easing.Cubic.InOut )
            .start()
            .onComplete(function() {
                that.state = "idle";
                that.state_locked = false;
            });

        var tween = new TWEEN.Tween(this.dolly.rotation)
            .to({x : 0, y: 0}, 1000*this.animation_speed)
            .easing( TWEEN.Easing.Cubic.InOut )
            .start();
    }
    if (this.state == "jump-to-section") {
        if (this.state_locked) return;
        this.state_locked = true;
        var label = this.selected_section.name;
        if (this.selected_section.max_dq_price) {
            label += ', $' + this.selected_section.max_dq_price;
        }
        this.build_label(label);
        this.display_seatview(this.selected_section.name);

        var origin     = new THREE.Vector3(0,0,0),
            line       = new THREE.Line3(this.selected_section.position, origin),
            distance   = line.distance(),
            distance_modifier = this.show_reverse ? 2 : 10,
            camera_pos = line.at(distance_modifier/distance);

        camera_pos.setZ(this.selected_section.position.z + 3);

        this.tween = new TWEEN.Tween(this.dolly.position)
            .to(camera_pos, 1000)
            .easing( TWEEN.Easing.Cubic.InOut )
            .start()
            .onComplete(function() {
                that.animate_selected_section(true);
                that.state = 'idle';
                that.state_locked = false;
            });

        var y = Math.atan((that.selected_section.position.y - camera_pos.y)/(that.selected_section.position.x - camera_pos.x)) + Math.PI/2;

        if (
            (that.selected_section.position.x > 0 && !this.show_reverse) || 
            (that.selected_section.position.x <= 0 && this.show_reverse)) {
            y = y - Math.PI;
        }

        new TWEEN.Tween(this.dolly.rotation)
            .to({
                x: Math.PI/2,
                y: y
            }, 1000)
            .easing( TWEEN.Easing.Cubic.InOut )
            .start();
     }

     if (this.state == "oak") {
        if (this.state_locked) return;
        this.state_locked = true;
        new TWEEN.Tween(
            this.dolly.position
        ).to(
            new THREE.Vector3(2200, 2200, 70),
            5000
        )
        .easing( TWEEN.Easing.Cubic.InOut ).start()
        .onComplete(function() {
            that.state = 'tipover';
            that.state_locked = false;
        });

        new TWEEN.Tween(
            this.dolly.rotation
        ).to(
            {
                y: Math.PI*1.8
            },
            5000
        ).easing( TWEEN.Easing.Cubic.InOut ).start();
     }

     if (this.state == "tipover") {
        if (this.state_locked == true) return;
        this.state_locked = true;
        var tree = this.oak.get_object();
        // tree.rotation.z = -Math.PI/2.5;

        new TWEEN.Tween(
            tree.rotation
        ).to(
            {
                z:  -Math.PI/2.5
            },
            2000
        ).easing( TWEEN.Easing.Bounce.Out ).delay(1000).start();
     }
};

World.prototype.animate_selected_section = function (restart) {
    var that = this;
    if (restart) {
        if (this.hover_animation) {
            this.hover_animation.stop();
        }
        if (this.hover_target) {
            this.hover_target.position.z = this.hover_z;
        }
        this.hover_target = this.selected_section.object;
        this.hover_z = this.hover_target.position.z;
    }
    this.hover_animation = new TWEEN.Tween(
        this.hover_target.position
    ).to({ z: this.hover_z + .5 }, 2000
    ).easing( TWEEN.Easing.Cubic.InOut ).start()
    .onComplete(function() {
        that.hover_animation = new TWEEN.Tween(
            that.hover_target.position
        ).to({ z: that.hover_z - .5 }, 2000
        ).easing( TWEEN.Easing.Quadratic.InOut ).start()
        .onComplete(function() {
            that.animate_selected_section(false);
        });
    });
};




var world = new World();

window.addEventListener("load", world.init.bind(world));
window.addEventListener( 'dblclick', world.enter_vr.bind(world));
window.addEventListener( 'resize', world.onWindowResize.bind(world), false );

function handlePostmessage(e) {
    if (e.data.mode) {
        changeMode(e.data.mode);
    }
}

window.addEventListener('message', handlePostmessage);

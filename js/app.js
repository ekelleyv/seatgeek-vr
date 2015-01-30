'use strict';

var World = function() {};

World.prototype.init = function() {

    this.renderer = this.init_renderer();
    this.scene = this.init_scene();
    this.camera = this.init_camera();
    this.lights = this.init_lights();

    this.vr_effect = new THREE.VREffect( this.renderer );
    this.vr_controls = new THREE.VRControls( this.camera );



    this.mono_controls = new THREE.OrbitControls( this.camera );

    this.change_mode("vr");





    this.load_geo();
    this.load_listings();

    requestAnimationFrame(this.render.bind(this));

};

World.prototype.load_geo = function() {
    var that = this;
    $.getJSON("/data/yankees_geo.json", function(data) {
        console.log("Received geo json");
        that.geo_data = data;
        that.process_mapdata();
    });
};

World.prototype.load_listings = function() {
    var that = this;
    $.getJSON("/data/yankees_listings.json", function(data) {
        console.log("Received listings json");
        that.listings_data = data;
        that.process_mapdata();
    });
};

World.prototype.process_mapdata = function() {
    if (!this.geo_data || !this.listings_data) {
        return;
    }
    this.mapdata = {};

    var sections = this.geo_data.sections;

    for (var section_name in sections) {
        var section = sections[section_name];
        this.mapdata[section_name] = {
            center : section.center,
            points : section.points[0],
            listings: []
        }
    }

    for (var i = 0; i < this.listings_data.listings.length; i++) {
        var listing = this.listings_data.listings[i];
        if (listing.mk) {
            var re = /^s:((?:\w|-)+)/;
            var section_name = re.exec(listing.mk)[1];

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

    // var axisHelper = new THREE.AxisHelper( 10 );
    // scene.add( axisHelper );
    var ground = new THREE.Mesh(new THREE.PlaneBufferGeometry( 500, 500, 100, 100 ), new THREE.MeshLambertMaterial({
        ambient: 0xffffff,
        color: 0xffffff,
        // specular: 0x050505
    }));

    ground.receiveShadow = true;
    // scene.add(ground);


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
    camera.position.set( 0, 0, 70);
    //camera.lookAt(new THREE.Vector3(0, 0, 0) );

    // this.dolly = new THREE.Group();

    // this.dolly.add(camera);

    // this.scene.add(this.dolly);

    return camera;
}

World.prototype.color_for_bucket = function(bucket) {
    var colors = [
        "#2378c5",
        "#e40909",
        "#f64f06",
        "#ed860c",
        "#91b308",
        "#609d0d",
        "#518202"
    ];

    return colors[bucket];
};


World.prototype.build_stadium =  function () {
    this.stadium_group = new THREE.Object3D();

    for (var section_name in this.mapdata) {
        var section = this.mapdata[section_name];
        var building_material = new THREE.MeshPhongMaterial({color : this.color_for_bucket(section.max_dq_bucket)});
        var shape = this.convert_shape(section.points);
        var geometry = shape
          .extrude({
            amount: 0.35,
            bevelEnabled: false
          });
        var object = new THREE.Mesh(geometry, building_material);
        // object.position.z = this.mapdata[section_name].max_dq_bucket|| 0;
        this.stadium_group.add(object);
    }

    this.scene.add(this.stadium_group);
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

World.prototype.render = function() {
    requestAnimationFrame( this.render.bind(this) );

    // if (typeof this.controls.update == 'function') {
    //     this.controls.update();
    // }
    this.controls.update();
    // the camera position changes when the oculus is in front
    // of the viewer, so this is a temporary fix
    this.camera.position.set( 0, 0, 70);
    this.effect.render( this.scene, this.camera );
    console.log('render');
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

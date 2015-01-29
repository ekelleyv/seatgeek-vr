'use strict';

var World = function() {};

World.prototype.init = function() {

    this.renderer = this.init_renderer();
    this.scene = this.init_scene();
    this.camera = this.init_camera();

    this.load_geo();
    this.load_listings();

    window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
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

World.prototype.init_renderer = function() {
    var renderer =  new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMapEnabled = true;
    renderer.shadowMapSoft = true;
    renderer.setClearColor( 0x98D3F5, 1 );
    renderer.domElement.id = "world";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.zIndex   = 0;
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
    // scene.fog = new THREE.Fog( 0xffffff, 1, 7000 );
    // scene.fog.color.setHSL( 0.6, 0, 1 );
    return scene;
};

World.prototype.init_camera = function() {
    var WIDTH = window.innerWidth,
        HEIGHT = window.innerHeight;

    var VIEW_ANGLE = 45,
        ASPECT = WIDTH / HEIGHT,
        NEAR = 0.1,
        FAR = 10000;
    var camera = new THREE.PerspectiveCamera(  VIEW_ANGLE,
                                ASPECT,
                                NEAR,
                                FAR  );
    camera.position.set( 0, -75, 100);
    camera.lookAt(new THREE.Vector3(0, 0, 0) );

    this.scene.add(camera);

    return camera;
}


World.prototype.build_stadium =  function () {
    this.stadium_group = new THREE.Object3D();
    var building_material = new THREE.MeshNormalMaterial();

    for (var section_name in this.mapdata) {
        var section = this.mapdata[section_name];
        var shape = this.convert_shape(section.points);
        var geometry = shape
          .extrude({
            amount: 0.35,
            bevelEnabled: false
          });
        var object = new THREE.Mesh(geometry, building_material);
        // object.position.y = this.mapdata[section_name].max_dq || 0;
        object.castShadow = true;
        object.receiveShadow = true;
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
    this.renderer.render( this.scene, this.camera );
    requestAnimationFrame( this.render.bind(this) );
};




var world = new World();

window.addEventListener("load", world.init.bind(world));

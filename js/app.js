'use strict';

var World = function() {};

World.prototype.init = function() {

    this.renderer = this.init_renderer();
    this.scene = this.init_scene();
    this.camera = this.init_camera();


    this.build_stadium();

    window.addEventListener( 'resize', this.onWindowResize.bind(this), false );
    requestAnimationFrame(this.render.bind(this));

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
    scene.fog = new THREE.Fog( 0xffffff, 1, 7000 );
    scene.fog.color.setHSL( 0.6, 0, 1 );
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
    // camera.position.set( 0, 50, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0) );
    camera.h_rotation = 0;

    this.scene.add(camera);

    return camera;
}


World.prototype.build_stadium =  function () {
    var geometry = new THREE.BoxGeometry( 1, 1, 1 );
    var material = new THREE.MeshNormalMaterial();
    var cube = new THREE.Mesh( geometry, material );
    this.scene.add( cube );
    this.camera.position.z = -5;
    this.camera.position.y = 5;
    this.camera.position.x = -5;
    this.camera.lookAt(new THREE.Vector3(0, 0, 0) );
};

World.prototype.convert_shape = function (geometry) {
      if (geometry.type !== "Polygon") {
        throw "Only Polygons are currently supported";
      }
      var vertices = geometry.coordinates[0];
      var pts = [];
      for (var i = 0; i < vertices.length; ++i) {
        pts.push(new THREE.Vector2(vertices[i][1], vertices[i][0]));
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

// setTimeout(function () {
//   $.get("citi-field.geo.json", function (data) {
//     world.data = data.features;
//     world.build_stadium();
//   });
// }, 500);

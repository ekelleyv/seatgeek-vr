var Oak = function() {
    this.init = function(scene) {
        var manager = new THREE.LoadingManager();
        manager.onProgress = function ( item, loaded, total ) {

            console.log( item, loaded, total );

        };

        var texture = new THREE.Texture();

        var onProgress = function ( xhr ) {
            if ( xhr.lengthComputable ) {
                var percentComplete = xhr.loaded / xhr.total * 100;
                console.log( Math.round(percentComplete, 2) + '% downloaded' );
            }
        };

        var onError = function ( xhr ) {
        };


        var loader = new THREE.ImageLoader( manager );
        loader.load( 'tree.jpg', function ( image ) {

            texture.image = image;
            texture.needsUpdate = true;

        } );

        // model
        var that = this;

        var loader = new THREE.OBJLoader( manager );
        loader.load( 'tree.obj', function ( object ) {

            object.traverse( function ( child ) {

                if ( child instanceof THREE.Mesh ) {

                    child.material.map = texture;

                }

            } );

            object.rotation.x = Math.PI/2;
            object.position.x = 2500;
            object.position.y = 2500;

            object.scale = 0.1;
            scene.add( object );
            that.tree = object;
            return object;

        }, onProgress, onError );

    }

    this.get_object = function() {
        return this.tree;
    }

}

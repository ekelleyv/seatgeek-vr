var Boid = function() {

    var vector = new THREE.Vector3(),
    _acceleration, _width = 500, _height = 500, _depth = 200, _goal, _neighborhoodRadius = 100,
    _maxSpeed = 4, _maxSteerForce = 0.1, _avoidWalls = false;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    _acceleration = new THREE.Vector3();

    this.setGoal = function ( target ) {

        _goal = target;

    }

    this.setAvoidWalls = function ( value ) {

        _avoidWalls = value;

    }

    this.setWorldSize = function ( width, height, depth ) {

        _width = width;
        _height = height;
        _depth = depth;

    }

    this.run = function ( boids ) {

        if ( _avoidWalls ) {

            vector.set( - _width, this.position.y, this.position.z );
            vector = this.avoid( vector );
            vector.multiplyScalar( 5 );
            _acceleration.add( vector );

            vector.set( _width, this.position.y, this.position.z );
            vector = this.avoid( vector );
            vector.multiplyScalar( 5 );
            _acceleration.add( vector );

            vector.set( this.position.x, - _height, this.position.z );
            vector = this.avoid( vector );
            vector.multiplyScalar( 5 );
            _acceleration.add( vector );

            vector.set( this.position.x, _height, this.position.z );
            vector = this.avoid( vector );
            vector.multiplyScalar( 5 );
            _acceleration.add( vector );

            vector.set( this.position.x, this.position.y, - _depth );
            vector = this.avoid( vector );
            vector.multiplyScalar( 5 );
            _acceleration.add( vector );

            vector.set( this.position.x, this.position.y, _depth );
            vector = this.avoid( vector );
            vector.multiplyScalar( 5 );
            _acceleration.add( vector );

        }/* else {

            this.checkBounds();

        }
        */

        if ( Math.random() > 0.5 ) {

            this.flock( boids );

        }

        this.move();

    }

    this.flock = function ( boids ) {

        if ( _goal ) {

            _acceleration.add( this.reach( _goal, 0.005 ) );

        }

        _acceleration.add( this.alignment( boids ) );
        _acceleration.add( this.cohesion( boids ) );
        _acceleration.add( this.separation( boids ) );

    }

    this.move = function () {

        this.velocity.add( _acceleration );

        var l = this.velocity.length();

        if ( l > _maxSpeed ) {

            this.velocity.divideScalar( l / _maxSpeed );

        }

        this.position.add( this.velocity );
        _acceleration.set( 0, 0, 0 );

    }

    this.checkBounds = function () {

        if ( this.position.x >   _width ) this.position.x = - _width;
        if ( this.position.x < - _width ) this.position.x =   _width;
        if ( this.position.y >   _height ) this.position.y = - _height;
        if ( this.position.y < - _height ) this.position.y =  _height;
        if ( this.position.z >  _depth ) this.position.z = - _depth;
        if ( this.position.z < - _depth ) this.position.z =  _depth;

    }

    //

    this.avoid = function ( target ) {

        var steer = new THREE.Vector3();

        steer.copy( this.position );
        steer.sub( target );

        steer.multiplyScalar( 1 / this.position.distanceToSquared( target ) );

        return steer;

    }

    this.repulse = function ( target ) {

        var distance = this.position.distanceTo( target );

        if ( distance < 150 ) {

            var steer = new THREE.Vector3();

            steer.subVectors( this.position, target );
            steer.multiplyScalar( 0.5 / distance );

            _acceleration.add( steer );

        }

    }

    this.reach = function ( target, amount ) {

        var steer = new THREE.Vector3();

        steer.subVectors( target, this.position );
        steer.multiplyScalar( amount );

        return steer;

    }

    this.alignment = function ( boids ) {

        var boid, velSum = new THREE.Vector3(),
        count = 0;

        for ( var i = 0, il = boids.length; i < il; i++ ) {

            if ( Math.random() > 0.6 ) continue;

            boid = boids[ i ];

            distance = boid.position.distanceTo( this.position );

            if ( distance > 0 && distance <= _neighborhoodRadius ) {

                velSum.add( boid.velocity );
                count++;

            }

        }

        if ( count > 0 ) {

            velSum.divideScalar( count );

            var l = velSum.length();

            if ( l > _maxSteerForce ) {

                velSum.divideScalar( l / _maxSteerForce );

            }

        }

        return velSum;

    }

    this.cohesion = function ( boids ) {

        var boid, distance,
        posSum = new THREE.Vector3(),
        steer = new THREE.Vector3(),
        count = 0;

        for ( var i = 0, il = boids.length; i < il; i ++ ) {

            if ( Math.random() > 0.6 ) continue;

            boid = boids[ i ];
            distance = boid.position.distanceTo( this.position );

            if ( distance > 0 && distance <= _neighborhoodRadius ) {

                posSum.add( boid.position );
                count++;

            }

        }

        if ( count > 0 ) {

            posSum.divideScalar( count );

        }

        steer.subVectors( posSum, this.position );

        var l = steer.length();

        if ( l > _maxSteerForce ) {

            steer.divideScalar( l / _maxSteerForce );

        }

        return steer;

    }

    this.separation = function ( boids ) {

        var boid, distance,
        posSum = new THREE.Vector3(),
        repulse = new THREE.Vector3();

        for ( var i = 0, il = boids.length; i < il; i ++ ) {

            if ( Math.random() > 0.6 ) continue;

            boid = boids[ i ];
            distance = boid.position.distanceTo( this.position );

            if ( distance > 0 && distance <= _neighborhoodRadius ) {

                repulse.subVectors( this.position, boid.position );
                repulse.normalize();
                repulse.divideScalar( distance );
                posSum.add( repulse );

            }

        }

        return posSum;

    }

}


var Boids = function() {
    this.init = function(scene) {
        this.birds = [];
        this.boids = [];
        var boid_group = new THREE.Group();
        for ( var i = 0; i < 30; i ++ ) {

            boid = this.boids[ i ] = new Boid();
                    boid.position.x = Math.random() * 2000 - 1000;
                    boid.position.y = Math.random() * 2000 - 1000;
                    boid.position.z = Math.random() * 400;
                    boid.velocity.x = Math.random() * 2 - 1;
                    boid.velocity.y = Math.random() * 2 - 1;
                    boid.velocity.z = Math.random() * 2 - 1;
            boid.setAvoidWalls( true );
            boid.setWorldSize( 1000, 1000, 400 );



            bird = this.birds[ i ] = new THREE.Mesh( new Bird(), new THREE.MeshBasicMaterial( { color:0x222222, side: THREE.DoubleSide } ) );
            bird.phase = Math.floor( Math.random() * 62.83 );
            boid_group.add(bird);

        }

        boid_group.position.z += 400;

        scene.add(boid_group);
    }

    this.render = function() {
        for ( var i = 0, il = this.birds.length; i < il; i++ ) {
            boid = this.boids[ i ];
            boid.run( this.boids );

            bird = this.birds[ i ];
            bird.position.copy( this.boids[ i ].position );

            color = bird.material.color;
            color.r = color.g = color.b = ( 500 - bird.position.z ) / 1000;

            bird.rotation.y = Math.atan2( - boid.velocity.z, boid.velocity.x );
            bird.rotation.z = Math.asin( boid.velocity.y / boid.velocity.length() );

            bird.phase = ( bird.phase + ( Math.max( 0, bird.rotation.z ) + 0.1 )  ) % 62.83;
            bird.geometry.vertices[ 5 ].y = bird.geometry.vertices[ 4 ].y = Math.sin( bird.phase ) * 5;

        }
    }
}

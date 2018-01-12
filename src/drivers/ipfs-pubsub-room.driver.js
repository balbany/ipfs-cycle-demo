import xs from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';
import Room from 'ipfs-pubsub-room';

export function makeIPFSRoomDriver(roomName) {

    function ipfsRoomDriver(outgoing$) {
        //Bootstrap the IPFS node
        var ipfs = new window.Ipfs({
            repo: 'ipfs/pubsub-demo/' + Math.random(),
            EXPERIMENTAL: {
                pubsub: true // required, enables pubsub
            },
            config: {
                Addresses: {
                    Swarm: [
                        '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
                    ]
                }
            }
        })
            
        outgoing$.addListener({
            next: outgoing => {
                let room = Room(ipfs, roomName);
                room.broadcast(outgoing);
            },
            error: () => {},
            complete: () => {},
        });
    
        const incoming$ = xs.create({
            start: listener => {
                ipfs.once('ready', () => {
                    let room = Room(ipfs, roomName);
                    room.on('message', (message) => {
                        listener.next(message);
                    })
                });
            },
            stop: () => {},
        });
    
        return adapt(incoming$);
    }

    return ipfsRoomDriver

}


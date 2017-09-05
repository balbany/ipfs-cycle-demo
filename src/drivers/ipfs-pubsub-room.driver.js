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
                // Need this while some IPFS gateways aren't handling websockets properly - see https://github.com/ipfs/js-ipfs/issues/941
                Bootstrap: [
                  "/dns4/sfo-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx",
                  "/dns4/lon-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3",
                  "/dns4/sfo-2.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z",
                  "/dns4/sfo-3.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM",
                  "/dns4/sgp-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu",
                  "/dns4/nyc-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm",
                  "/dns4/nyc-2.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64"
                ]
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


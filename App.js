

import React from 'react';
import {  View,Button,StyleSheet,SafeAreaView} from 'react-native';
import VideoPlayer from 'react-native-video-player'

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals
} from 'react-native-webrtc';


registerGlobals();

import { useState, useEffect } from 'react';

import { Device } from 'mediasoup-client'

const websockUri = 'ws://54.165.232.132:8080/ws'

let bntSub;
let bntCam;
let bntScreen;
let textPublish;
let textWebcam;
let textScreen;
let textSubscribe;
let localVideo;
let remoteVideo;
let remoteStream;
let device;
let producer;
let transport;
let userId;
let isWebcam;
let produceCallback, produceErrback;
let consumerCallback, consumerErrback;
let iceServers;

let stream;
let socket;

let publish;
let subscribe;

const App = () => {
 
  const [webcamStream, setWebcamStream] = useState({})

  const [subscribedStream, setSubscribedStream] = useState( null)
  // const [cameraStream, setStream] = useState(null);
  useEffect(() => {

    connect()

  }, [])



  const connect = () => {
 
    socket = new WebSocket(websockUri)


    socket.onopen = () => {
    

      const msg = {
        type: "getRouterRtpCapabilities"
      }
      const resp = JSON.stringify(msg);

      socket.send(resp);

    }
    socket.onmessage = (event) => {

     
      const jsonValidation = IsJsonString(event.data);
      if (!jsonValidation) {
        console.error('json error')
        return
      }
      let resp = JSON.parse(event.data);

      switch (resp.type) {
        case 'routerCapabilities':
          onRouterCapabilities(resp);

          break;
        case 'producerTransportCreated':
          onProducerTransportCreated(resp);
          break;
        case 'subTransportCreated':
          onSubTransportCreated(resp)
          break;
        case 'resumed':
          console.log(event.data)
          break
        case 'subscribed':
          onSubscribed(resp)
          break
        default:
          break;
      }
    }

  }
  const onSubscribed = async (event) => {
 
    const {
      producerId,
      id,
      kind,
      rtpParameters,
    } = event.data;
    let codecOptions = {};
    const consumer = await transport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
      codecOptions
    })
    const stream = new MediaStream();
    stream.addTrack(consumer.track);
    setSubscribedStream(stream)
    console.log("initial stream ", stream )
  }
  const onSubTransportCreated = async (event) => {


    if (event.error) {
      console.error("on Sub transport created error", event.error)
      return
    }
    console.log("reciever side event data -> ",event.data)
 
    transport = device.createRecvTransport(event.data);
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      const msg = {
        type: 'connectConsumerTransport',
        transportId: transport.id,
        dtlsParameters,
       
      }
      const resp = JSON.stringify(msg);
      socket.send(resp);

      socket.addEventListener('message', (event) => {

        const jsonValidation = IsJsonString(event.data);
        if (!jsonValidation) {
          console.error('json error')
          return
        }
        let resp = JSON.parse(event.data);
        if (resp.type === "subConnected") {
          console.log("consumer transport connected")
          callback();
        }
      })
    });

    //connection state change begin
    transport.on('connectionstatechange', (state) => {

      switch (state) {
        case 'connecting':
          console.log("connecting")
          break;
        case 'connected':
          // liveStream = stream
          console.log("connected")

          // setSubscribedStream(stream);
          // console.log("from connected", stream)
          const msg = {
            type: 'resume'
          }
          const resp = JSON.stringify(msg);
          socket.send(resp)
          textPublish.innerHTML = 'subscribed';
          break;
        case 'failed':
          console.log("failed")
          transport.close();
          textPublish.innerHTML = 'failed';
          break;
        default:
          break;
      }
    });
    const stream = consumer(transport)
    //connection state change end



  }
  const consumer = async (transport) => {
    const { rtpCapabilities } = device;
    const msg = {
      type: 'consume',
      rtpCapabilities
    }

    const resp = JSON.stringify(msg);
    socket.send(resp)
  }

  const onProducerTransportCreated = async (event) => {


    if (event.error) {
      console.error("producer transport created error", event.error)
      return
    }
    console.log("sender side event data -> ",event.data)

    const transport = device.createSendTransport(event.data);
    
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      const msg = {
        type: 'connectProducerTransport',
        dtlsParameters,
      
      }
      const resp = JSON.stringify(msg);
      socket.send(resp);

      socket.addEventListener('message', (event) => {

        const jsonValidation = IsJsonString(event.data);
        if (!jsonValidation) {
          console.error('json error')
          return
        }
        let resp = JSON.parse(event.data);
        if (resp.type === "producerConnected") {
          console.log("producer connected")
          callback();
        }
      })
    });
    //begin transport on producer
    transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
     
      const msg = {
        type: 'produce',
        transportId: transport.id=
        kind,
        rtpParameters
      };
      const resp = JSON.stringify(msg)
      socket.send(resp);
      socket.addEventListener('message', (resp) => {
        let parsedResponse = JSON.parse(resp.data)
        callback(parsedResponse.data.id)
      })
    });
    //end transport producer
    //connection state change begin
    transport.on('connectionstatechange', (state) => {
    
      switch (state) {
        case 'connecting':
          textPublish.innerHTML = "publishing .....";
          break;
        case 'connected':
          // liveStream = stream
          console.log("this is from localVideo before assignment = > ", localVideo)
          setWebcamStream(stream);
          console.log("this is from localVideo = > ", localVideo)
          textPublish.innerHTML = 'published';
          break;
        case 'failed':
          transport.close();
          textPublish.innerHTML = 'failed';
          break;
        default:
          break;
      }
    });
    //connection state change end

    try {
      stream = await getUserMedia(transport, isWebcam);
      const track = stream.getVideoTracks()[0]
      const params = { track };
    
      producer = await transport.produce(params)
   
    } catch (error) {
      console.error(error);

    }

  }
  const onRouterCapabilities = (resp) => {
 
    loadDevice(resp.data);
    
  }
  publish = () => {

    const msg = {
      type: "createProducerTransport",
      forceTcp: false,
      rtpCapabilities: device.rtpCapabilities
    }
    const resp = JSON.stringify(msg);
    socket.send(resp);
  }
  subscribe =  () => {
    // let s;
    // try {
    //   s = await mediaDevices.getUserMedia({ video: true });

    //   setStream(s);
    //   console.log("stream - > ",s);
    // } catch(e) {
    //   console.error(e);
    // }
  
    const msg = {
      type: "createConsumerTransport",
      forceTcp: false,

    }
    const resp = JSON.stringify(msg);
    socket.send(resp);
  }
  const IsJsonString = (str) => {
    try {
      JSON.parse(str)
    } catch (error) {
      return false
    }
    return true
  }



  const loadDevice = async (routerRtpCapabilities) => {
   
    try {
     
      device = new Device();
    
    } catch (error) {
      // if (error.name == 'UnsupportedError') {
      console.log("browser not supported", error.name)
      // }
    }
    await device.load({ routerRtpCapabilities })
  }
  const getUserMedia = async (transport, iswebcam) => {
    if (!device.canProduce('video')) {
      console.error('cannot produce video')
      return
    }
    let stream;
    try {
      stream =
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      // await navigator.mediaDevices.getDisplayMedia({ video: true })
    } catch (error) {
      console.error(error)
      throw error
    }
    return stream;
  }
  console.log("device in load device ", device)
  console.log("subscribed video",subscribedStream)
  return (
<SafeAreaView >
     
 {subscribedStream && <RTCView
      key={1}
      zOrder={20}
      objectFit="cover"
      style={{ ...styles.rtcView }}
      streamURL={subscribedStream.toURL()}
    />
    }
     <Button
           onPress={() => subscribe()}
          title="Subcribe"
          color="#841584"

        />
    

    </SafeAreaView>


  );
};

// const styles = StyleSheet.create({
  
//   stream: {
//     height:'50%',
//     width:'60%'
//   }

// });
 
 /* <VideoPlayer
         video={{ uri: subscribedStream.toURL() }}
         videoWidth={1600}
         videoHeight={900}
           /> */
const styles = StyleSheet.create({
  rtcView: {
    width: 400, //dimensions.width,
    height: 400, //dimensions.height / 2,
    backgroundColor: 'black',
  },
});
export default App;

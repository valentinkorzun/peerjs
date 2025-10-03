
import type { Ref } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

import CryptoJS from 'crypto-js';


function randomID(len: number) {
  let result = '';
  if (result) return result;

  // eslint-disable-next-line
  var chars = '12345qwertyuiopasdfgh67890jklmnbvcxzMNBVCZXASDQWERTYHGFUIOLKJP',
    maxPos = chars.length,
    i;
  len = len || 5;
  for (i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return result;
}

function makeNonce() {
  return Math.floor(Math.random() * (2147483647 - (-2147483648) + 1)) + 
    (-2147483648);
}

function makeRandomIv() {
  const str = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += str.charAt(Math.floor(Math.random() * str.length));
  }
  return result;
}

function aesEncrypt(plainText: string, key: string, iv: string) {
  const keyWords = CryptoJS.enc.Utf8.parse(key);
  const ivWords = CryptoJS.enc.Utf8.parse(iv);
  
  const encrypted = CryptoJS.AES.encrypt(plainText, keyWords, {
    iv: ivWords,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return encrypted.ciphertext;
}

// get token
function generateToken(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload = ''
) {
  if (!appId || typeof appId !== 'number') {
    throw new Error('appID invalid');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId invalid');
  }
  if (!secret || typeof secret !== 'string' || secret.length !== 32) {
    throw new Error('secret must be a 32 byte string');
  }
  if (
    !effectiveTimeInSeconds ||
    typeof effectiveTimeInSeconds !== 'number'
  ) {
    throw new Error('effectiveTimeInSeconds invalid');
  }

  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: makeNonce(),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload
  };

  const plainText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const encryptedWordArray = aesEncrypt(plainText, secret, iv);
  
  const encryptedBytes = new Uint8Array(encryptedWordArray.sigBytes);
  for (let i = 0; i < encryptedWordArray.sigBytes; i++) {
    encryptedBytes[i] =
      (encryptedWordArray.words[Math.floor(i / 4)] >>>
        (24 - (i % 4) * 8)) &
      0xff;
  }

  const expireBytes = new Uint8Array(8);
  const dataView = new DataView(expireBytes.buffer);
  const expireTime = tokenInfo.expire;
  dataView.setUint32(0, Math.floor(expireTime / 4294967296), false);
  dataView.setUint32(4, expireTime >>> 0, false);

  const ivLengthBytes = new Uint8Array(2);
  new DataView(ivLengthBytes.buffer).setUint16(0, iv.length, false);

  const ivBytes = new TextEncoder().encode(iv);

  const encryptedLengthBytes = new Uint8Array(2);
  new DataView(encryptedLengthBytes.buffer).setUint16(
    0,
    encryptedBytes.length,
    false
  );

  const totalLength =
    expireBytes.length +
    ivLengthBytes.length +
    ivBytes.length +
    encryptedLengthBytes.length +
    encryptedBytes.length;
  const finalBytes = new Uint8Array(totalLength);
  
  let offset = 0;
  finalBytes.set(expireBytes, offset);
  offset += expireBytes.length;
  finalBytes.set(ivLengthBytes, offset);
  offset += ivLengthBytes.length;
  finalBytes.set(ivBytes, offset);
  offset += ivBytes.length;
  finalBytes.set(encryptedLengthBytes, offset);
  offset += encryptedLengthBytes.length;
  finalBytes.set(encryptedBytes, offset);

  let binary = '';
  for (let i = 0; i < finalBytes.length; i++) {
    binary += String.fromCharCode(finalBytes[i]);
  }
  const base64 = btoa(binary);

  return '04' + base64;
}

function getUrlParams(
  url: string = window.location.href
): URLSearchParams {
  const urlStr = url.split('?')[1];
  return new URLSearchParams(urlStr);
}

export default function App() {

  const ZEGO_APP_ID = parseInt(getUrlParams().get('appId') || '0');
  const ZEGO_SERVER_SECRET = getUrlParams().get('appSecret') || '';

  console.log(ZEGO_APP_ID, ZEGO_SERVER_SECRET);

  
  const roomID = getUrlParams().get('roomID') || randomID(5);
  const userID = randomID(5);
  const userName = randomID(5);
  const myMeeting = async (element: HTMLDivElement) => {
    // generate token
    const token = await generateToken(
      ZEGO_APP_ID,
      userID,
      ZEGO_SERVER_SECRET,
      24 * 60 * 60
    );

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
      ZEGO_APP_ID,
      token,
      roomID,
      userID,
      userName
    );
    // create instance object from token
    const zp = ZegoUIKitPrebuilt.create(kitToken);
    // start the call
    zp.joinRoom({
      container: element,
      sharedLinks: [
        {
          name: 'Personal link',
          url:
            window.location.origin +
            window.location.pathname +
            '?roomID=' +
            roomID,
        },
      ],
      scenario: {
        mode: ZegoUIKitPrebuilt.GroupCall, // To implement 1-on-1 calls, modify the parameter here to [ZegoUIKitPrebuilt.OneONoneCall].
      },
    });
  };

  return (
    <div
      className="myCallContainer"
      ref={myMeeting as unknown as Ref<HTMLDivElement>}
      style={{ width: '100vw', height: '100vh' }}
    ></div>
  );
}

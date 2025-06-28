import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import NearpayTerminalSdk, {
  Environment,
  Country,
  PaymentScheme,
  TerminalModel,
  TransactionResponse,
} from 'nearpay-rn-terminal-sdk';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const JWT_TOKEN =
    '<eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Im9wcyI6ImF1dGgiLCJjbGllbnRfdXVpZCI6ImNlN2Y3MDc0LThmYmItNDEwNC04ODA2LTdkMmVhNGVkNzNkNiIsInRlcm1pbmFsX2lkIjoiMDIxMTUzMTMwMDExNTMxMyJ9LCJpYXQiOjE3NTExMzgwNTN9.NstKq_FUD_omtG1eMH3BG1jJe5WpVR87pB_4i7dop1UqnBLSNBbbh5dXf1m1dfEo61eZ1PAgygphUrk4IbShoUOtZxnDJYJC6_k70ZvIsENL7IxHzokys4SLszK0AEsPXPIUCyiibfDKWs87BV8WanPvOwbXSKRXWKMKfjoUT8tJ-esQcs-OBRcjxH9TuasKSBZeJE1AcJ5YjGVL8zAXTEqZmkQPCAqrV-vjT6aiOBWmOie71citQ19Jp-7DGcfNcnTQeq-u7Y3l_ibUvhj2OzEZ2G4gM_LVrywK2pAmBabA-xw5Vdcah5OQhJsaIVOUw1aD0CD-RAu10MsjCnJGQA>';
  const [connectedTerminal, setConnectedTerminal] =
    useState<TerminalModel | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await NearpayTerminalSdk.initialize({
          environment: Environment.SANDBOX,
          googleCloudProjectNumber: 1234567890,
          huaweiSafetyDetectApiKey: '<YOUR_HUAWEI_API_KEY>',
          country: Country.SA,
        });

        await NearpayTerminalSdk.requestPermissions();
        await NearpayTerminalSdk.verifyNfcAndWifi();

        const user = await NearpayTerminalSdk.jwtLogin(JWT_TOKEN);
        const userUUID = user.uuid;
        const terminalList = await NearpayTerminalSdk.getTerminalList(userUUID);
        const firstTerminal = terminalList[0];

        if (!firstTerminal) throw new Error('No terminal found');

        const connected = await NearpayTerminalSdk.connectTerminal({
          tid: firstTerminal.tid,
          userUUID: userUUID,
          terminalUUID: firstTerminal.uuid,
        });

        await connected.getTerminalConfig();
        setConnectedTerminal(connected);
        Alert.alert('نجح الاتصال', 'تم الاتصال بجهاز NearPay بنجاح');
      } catch (err) {
        console.warn('Init Error:', err);
        Alert.alert('خطأ في التهيئة', String(err));
      }
    })();
  }, []);

  const cardReaderCallbacks = {
    onReadingStarted: () => console.log('بدء قراءة البطاقة'),
    onReaderWaiting: () => console.log('في انتظار البطاقة'),
    onReaderReading: () => console.log('جاري قراءة البطاقة'),
    onReaderRetry: () => console.log('إعادة المحاولة'),
    onPinEntering: () => console.log('إدخال الرقم السري'),
    onReaderFinished: () => console.log('انتهت القراءة'),
    onReaderError: (msg: string) => console.error('خطأ في القارئ:', msg),
    onCardReadSuccess: () => console.log('قراءة البطاقة نجحت'),
    onCardReadFailure: (msg: string) => console.error('فشل القراءة:', msg),
  };

  const purchase = useCallback(
    async (amount: number, reference: string) => {
      if (!connectedTerminal) return Alert.alert('خطأ', 'لا يوجد اتصال');
      try {
        await connectedTerminal.purchase({
          transactionUuid: uuidv4(),
          amount,
          scheme: PaymentScheme.MADA,
          customerReferenceNumber: reference,
          callbacks: {
            cardReaderCallbacks,
            onPurchaseSuccess: (resp: TransactionResponse) => {
              console.log('نجحت العملية:', resp.id);
              Alert.alert('نجاح', `معرف العملية: ${resp.id}`);
            },
            onPurchaseFailed: (err: string) => {
              console.error('فشل العملية:', err);
              Alert.alert('فشل العملية', err);
            },
          },
        });
      } catch (err) {
        console.error('خطأ:', err);
        Alert.alert('خطأ في الدفع', String(err));
      }
    },
    [connectedTerminal],
  );

  const refund = useCallback(
    async (originalTxnUuid: string, amount: number, reference: string) => {
      if (!connectedTerminal) return Alert.alert('خطأ', 'لا يوجد اتصال');
      try {
        await connectedTerminal.refund({
          transactionUuid: originalTxnUuid,
          refundUuid: uuidv4(),
          amount,
          scheme: PaymentScheme.VISA,
          customerReferenceNumber: reference,
          callbacks: {
            cardReaderCallbacks,
            onRefundSuccess: (resp: TransactionResponse) => {
              console.log('تم الاسترداد:', resp.id);
              Alert.alert('تم', `معرف العملية: ${resp.id}`);
            },
            onRefundFailure: (err: string) => {
              console.error('فشل الاسترداد:', err);
              Alert.alert('فشل الاسترداد', err);
            },
          },
        });
      } catch (err) {
        console.error('خطأ:', err);
        Alert.alert('خطأ في الاسترداد', String(err));
      }
    },
    [connectedTerminal],
  );

  const onMessage = useCallback(
    async ({ nativeEvent: { data } }) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'PAY') {
          await purchase(Math.round(parsed.amount * 100), parsed.reference);
        } else if (parsed.type === 'REFUND') {
          await refund(
            parsed.originalTxnUuid,
            Math.round(parsed.amount * 100),
            parsed.reference,
          );
        } else {
          console.log('Unknown message type:', parsed.type);
        }
      } catch (err) {
        console.error('WebView message error:', err);
        Alert.alert('خطأ في الرسالة', String(err));
      }
    },
    [purchase, refund],
  );

  const injectedJS = `
    window.payWithNearpay = function(amount, reference) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAY',
        amount,
        reference: reference || 'WEB-' + Date.now()
      }));
    };
    window.refundWithNearpay = function(originalTxnUuid, amount, reference) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'REFUND',
        originalTxnUuid,
        amount,
        reference: reference || 'REFUND-' + Date.now()
      }));
    };
    true;
  `;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <WebView
        source={{ uri: 'https://netlos.vercel.app/' }}
        injectedJavaScript={injectedJS}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
      />
    </SafeAreaView>
  );
}

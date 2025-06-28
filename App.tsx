// App.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import NearpayTerminalSdk from 'nearpay-rn-terminal-sdk';
import { Environment, Country } from 'nearpay-rn-terminal-sdk';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { PaymentScheme } from 'nearpay-rn-terminal-sdk';

export default function App() {
  const JWT_TOKEN =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Im9wcyI6ImF1dGgiLCJjbGllbnRfdXVpZCI6ImNlN2Y3MDc0LThmYmItNDEwNC04ODA2LTdkMmVhNGVkNzNkNiIsInRlcm1pbmFsX2lkIjoiMDIxMTUzMTMwMDExNTMxMyJ9LCJpYXQiOjE3NTExMjA0NzR9.QQggtGrFRxDAoR3yoqD3O1gjK1Tfk_ihTtHbJOthQAn0RMNcSAfkGS3mMRow08nouTr1N7jKu9gDFAhOob0Rr4cuSHdpvgCBLI9Ptl4OC0gnfpEqV8gIJZ3RHgtmE0OvKBGRb0JagnEin2vTmiHXCVkW4SoTI1_JxsgrB_yWQmWLjJ4OU6a3ThOussES1XcGmChKXiq7zVEmx-cyWcsKiOMqBuIa9c477AslOCWrs8hbE8irJDsy-xb28LqhlBk1Hb_6SUci8oj8S6wjfq2Bh7ibslhu2P3U9ZdZyp45MgMtbCk-l4uGYeGYVmur14aANTy3stNXSkg2Te63NpYygw';

  const [connectedTerminal, setConnectedTerminal] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  /* ---------- تهيئة NearPay مرة واحدة ---------- */
  useEffect(() => {
    (async () => {
      try {
        // تهيئة الـ SDK
        await NearpayTerminalSdk.initialize({
          environment: Environment.SANDBOX,
          googleCloudProjectNumber: 1234567890,
          huaweiSafetyDetectApiKey: '<HUAWEI_KEY>',
          country: Country.SA,
        });

        // طلب الأذونات والتحقق من الاتصال
        await NearpayTerminalSdk.requestPermissions();
        await NearpayTerminalSdk.verifyNfcAndWifi();

        // تسجيل الدخول بـ JWT
        const terminal = await NearpayTerminalSdk.jwtLogin(JWT_TOKEN);
        setUser(terminal); // حفظ بيانات المستخدم

        // الحصول على قائمة الأجهزة
        const terminalList = await NearpayTerminalSdk.getTerminalList(
          terminal.userUUID,
        );
        const [firstTerminal] = terminalList;

        // الاتصال بالجهاز
        const connected = await NearpayTerminalSdk.connectTerminal({
          tid: firstTerminal.tid,
          userUUID: terminal.userUUID,
          terminalUUID: firstTerminal.uuid,
        });

        // الحصول على إعدادات الجهاز
        await connected.getTerminalConfig();

        setConnectedTerminal(connected);
        Alert.alert('نجح الاتصال', 'تم الاتصال بجهاز NearPay بنجاح');
      } catch (err) {
        console.warn('NearPay initialization error:', err);
        Alert.alert('خطأ في تهيئة NearPay', String(err));
      }
    })();
  }, []);

  /* ---------- تنفيذ عملية شراء ---------- */
  const purchase = async (amountHalala: number, reference: string) => {
    if (!connectedTerminal) {
      return Alert.alert('خطأ', 'الجهاز غير متصل بعد');
    }

    try {
      await connectedTerminal.purchase({
        transactionUuid: uuidv4(),
        amount: amountHalala, // المبلغ بالهللة
        scheme: PaymentScheme.VISA,
        customerReferenceNumber: reference,
        callbacks: {
          onPurchaseSuccess: (resp: any) => {
            console.log('Purchase successful:', resp.id);
            Alert.alert('تمت العملية بنجاح', `معرف العملية: ${resp.id}`);
          },
          onPurchaseFailed: (error: any) => {
            console.error('Purchase failed:', error);
            Alert.alert('فشل العملية', String(error));
          },
          cardReaderCallbacks: {
            onReadingStarted: () => console.log('بدء قراءة البطاقة...'),
            onReaderWaiting: () => console.log('في انتظار البطاقة...'),
            onReaderReading: () => console.log('جاري قراءة البطاقة...'),
            onReaderRetry: () => console.log('إعادة المحاولة...'),
            onPinEntering: () => console.log('أدخل الرقم السري...'),
            onReaderFinished: () => console.log('انتهت عملية القراءة'),
            onReaderError: (msg: string) =>
              console.error('خطأ في القارئ:', msg),
            onCardReadSuccess: () => console.log('نجحت قراءة البطاقة'),
            onCardReadFailure: (msg: string) =>
              console.error('فشل قراءة البطاقة:', msg),
          },
        },
      });
    } catch (e) {
      console.error('Purchase error:', e);
      Alert.alert('خطأ أثناء الشراء', String(e));
    }
  };

  /* ---------- تنفيذ عملية استرداد ---------- */
  const refund = async (
    originalTxnUuid: string,
    amountHalala: number,
    reference: string,
  ) => {
    if (!connectedTerminal) {
      return Alert.alert('خطأ', 'الجهاز غير متصل بعد');
    }

    try {
      await connectedTerminal.refund({
        transactionUuid: originalTxnUuid,
        refundUuid: uuidv4(),
        amount: amountHalala,
        scheme: PaymentScheme.VISA,
        customerReferenceNumber: reference,
        callbacks: {
          onRefundSuccess: (resp: any) => {
            console.log('Refund successful:', resp.id);
            Alert.alert('تم الاسترداد بنجاح', `معرف العملية: ${resp.id}`);
          },
          onRefundFailure: (error: any) => {
            console.error('Refund failed:', error);
            Alert.alert('فشل الاسترداد', String(error));
          },
          cardReaderCallbacks: {
            onReadingStarted: () => console.log('بدء عملية الاسترداد...'),
            onReaderWaiting: () =>
              console.log('في انتظار البطاقة للاسترداد...'),
            onReaderReading: () => console.log('جاري معالجة الاسترداد...'),
            onReaderFinished: () => console.log('انتهت عملية الاسترداد'),
            onReaderError: (msg: string) =>
              console.error('خطأ في الاسترداد:', msg),
          },
        },
      });
    } catch (e) {
      console.error('Refund error:', e);
      Alert.alert('خطأ أثناء الاسترداد', String(e));
    }
  };

  /* ---------- جسر WebView ---------- */
  const onMessage = useCallback(
    async (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        switch (data.type) {
          case 'PAY':
            await purchase(
              Math.round(data.amount * 100),
              data.reference || 'WEB-' + Date.now(),
            );
            break;
          case 'REFUND':
            await refund(
              data.originalTxnUuid,
              Math.round(data.amount * 100),
              data.reference || 'REFUND-' + Date.now(),
            );
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('WebView message error:', err);
        Alert.alert('خطأ في الرسالة', String(err));
      }
    },
    [connectedTerminal],
  );

  const injectedJS = `
    // وظيفة الدفع
    window.payWithNearpay = function(amount, reference) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAY',
        amount: amount,
        reference: reference || 'WEB-' + Date.now()
      }));
    };

    // وظيفة الاسترداد
    window.refundWithNearpay = function(originalTxnUuid, amount, reference) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'REFUND',
        originalTxnUuid: originalTxnUuid,
        amount: amount,
        reference: reference || 'REFUND-' + Date.now()
      }));
    };

    // إشعار بجاهزية الـ SDK
    window.nearPayReady = ${!!connectedTerminal};
    
    true;
  `;

  /* ---------- واجهة المستخدم ---------- */
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <WebView
        source={{ uri: 'https://netlos.vercel.app/' }}
        injectedJavaScript={injectedJS}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </SafeAreaView>
  );
}

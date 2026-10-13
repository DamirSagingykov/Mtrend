import Script from "next/script";

/** Подключение счётчиков. Скрипты загружаются только если ID заданы в настройках админ-панели. */
export function AnalyticsScripts({ ga4Id, metaPixelId, yandexId }: { ga4Id?: string; metaPixelId?: string; yandexId?: string }) {
  const ga = ga4Id && /^G-[A-Z0-9]+$/.test(ga4Id) ? ga4Id : null;
  const px = metaPixelId && /^\d+$/.test(metaPixelId) ? metaPixelId : null;
  const ym = yandexId && /^\d+$/.test(yandexId) ? yandexId : null;
  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {px && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${px}');fbq('track','PageView');`}
        </Script>
      )}
      {ym && (
        <Script id="ym" strategy="afterInteractive">
          {`window.__MT_YM_ID='${ym}';(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${ym},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false});`}
        </Script>
      )}
    </>
  );
}

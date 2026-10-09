package io.github.renatomecarelli.macrovision;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.provider.MediaStore;
import android.text.TextUtils;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.gms.common.moduleinstall.ModuleInstall;
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * MacroVision per Android: l'app web (cartella assets/www) dentro una WebView, più le funzioni del telefono
 * che una pagina web non ha: scanner di codici a barre di Google, salvataggio dei backup, foto, link esterni.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/index.html";
    private static final int REQ_FILE = 1, REQ_CAMERA = 2, REQ_SAVE = 3;
    private static final int BG = 0xFF090B14;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private String pendingSave;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        web = new WebView(this);
        web.setBackgroundColor(BG);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) edgeToEdge(getWindow(), root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        // Rispetta la dimensione del testo scelta nelle impostazioni del telefono, entro un limite che non rompe l'impaginazione
        int zoom = Math.round(getResources().getConfiguration().fontScale * 100);
        s.setTextZoom(Math.max(85, Math.min(zoom, 130)));
        s.setUserAgentString(s.getUserAgentString() + " MacroVisionAndroid/" + BuildConfig.VERSION_NAME);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            // Link con target=_blank: si aprono nel browser del telefono
            @Override
            public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, Message resultMsg) {
                WebView.HitTestResult hit = view.getHitTestResult();
                String url = hit != null ? hit.getExtra() : null;
                if (url != null && url.startsWith("http")) {
                    openExternal(Uri.parse(url));
                    return false;
                }
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                        openExternal(r.getUrl());
                        v.destroy();
                        return true;
                    }

                    @Override
                    public void onPageStarted(WebView v, String u, Bitmap favicon) {
                        if (u != null && u.startsWith("http")) {
                            v.stopLoading();
                            openExternal(Uri.parse(u));
                            v.destroy();
                        }
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }

            // <input type="file">: fotocamera per «Scatta foto», selettore di file per galleria e backup
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                if (params.isCaptureEnabled() && openCamera()) return true;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
            }
        });
        web.addJavascriptInterface(new Bridge(), "MVAndroid");
        if (Build.VERSION.SDK_INT >= 33) registerBack();
        web.loadUrl(START);
        prepareScanner();
    }

    @TargetApi(30)
    private static void edgeToEdge(Window w, View root) {
        w.setDecorFitsSystemWindows(false);
        WindowInsetsController c = w.getInsetsController();
        if (c != null) {
            c.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsets.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsets.CONSUMED;
        });
    }

    @TargetApi(33)
    private void registerBack() {
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
    }

    /** Il tasto indietro chiude i fogli dell'app (che usano la cronologia) e alla fine esce. */
    private void goBack() {
        if (web != null && web.canGoBack()) web.goBack();
        else finish();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        goBack();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private void prepareScanner() {
        try {
            GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(this);
            ModuleInstall.getClient(this).installModules(ModuleInstallRequest.newBuilder().addApi(scanner).build());
        } catch (Throwable ignored) {
            // senza Play Services l'app usa la lettura del codice da foto
        }
    }

    private void startScan() {
        GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_EAN_13, Barcode.FORMAT_EAN_8, Barcode.FORMAT_UPC_A, Barcode.FORMAT_UPC_E,
                        Barcode.FORMAT_QR_CODE, Barcode.FORMAT_DATA_MATRIX, Barcode.FORMAT_CODE_128, Barcode.FORMAT_ITF)
                .enableAutoZoom()
                .build();
        try {
            GmsBarcodeScanning.getClient(this, options).startScan()
                    .addOnSuccessListener(b -> callJs("MV_nativeScan",
                            JSONObject.quote(b.getRawValue() == null ? "" : b.getRawValue()), JSONObject.quote(format(b.getFormat()))))
                    .addOnCanceledListener(() -> callJs("MV_nativeScan", "null", "'cancel'"))
                    .addOnFailureListener(e -> callJs("MV_nativeScan", "null", "'error'"));
        } catch (Throwable t) {
            callJs("MV_nativeScan", "null", "'error'");
        }
    }

    private static String format(int f) {
        switch (f) {
            case Barcode.FORMAT_EAN_13: return "ean_13";
            case Barcode.FORMAT_EAN_8: return "ean_8";
            case Barcode.FORMAT_UPC_A: return "upc_a";
            case Barcode.FORMAT_UPC_E: return "upc_e";
            case Barcode.FORMAT_QR_CODE: return "qr_code";
            case Barcode.FORMAT_DATA_MATRIX: return "data_matrix";
            case Barcode.FORMAT_CODE_128: return "code_128";
            case Barcode.FORMAT_ITF: return "itf";
            default: return "unknown";
        }
    }

    private void callJs(String fn, String... args) {
        if (web == null) return;
        final String js = "window." + fn + "&&window." + fn + "(" + TextUtils.join(",", args) + ")";
        web.post(() -> {
            if (web != null) web.evaluateJavascript(js, null);
        });
    }

    private boolean openCamera() {
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) return false;
            File f = File.createTempFile("foto_", ".jpg", dir);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            i.setClipData(ClipData.newRawUri("", cameraUri));
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(i, REQ_CAMERA);
            return true;
        } catch (Exception e) {
            cameraUri = null;
            return false;
        }
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException ignored) {
            // nessun browser installato
        }
    }

    private void shareFile(String name, String content) {
        try {
            File dir = new File(getCacheDir(), "shared");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cartella");
            File f = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(content.getBytes(StandardCharsets.UTF_8));
            }
            Uri u = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent i = new Intent(Intent.ACTION_SEND).setType("application/json")
                    .putExtra(Intent.EXTRA_STREAM, u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(i, name));
            callJs("MV_nativeSaved", "true");
        } catch (Exception e) {
            callJs("MV_nativeSaved", "false");
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE || req == REQ_CAMERA) {
            Uri[] result = null;
            if (res == RESULT_OK) {
                if (req == REQ_CAMERA) result = cameraUri != null ? new Uri[]{cameraUri} : null;
                else result = WebChromeClient.FileChooserParams.parseResult(res, data);
            }
            if (fileCallback != null) fileCallback.onReceiveValue(result);
            fileCallback = null;
            cameraUri = null;
        } else if (req == REQ_SAVE) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "w")) {
                    if (out != null) {
                        out.write(pendingSave.getBytes(StandardCharsets.UTF_8));
                        ok = true;
                    }
                } catch (Exception e) {
                    ok = false;
                }
            }
            pendingSave = null;
            callJs("MV_nativeSaved", ok ? "true" : "false");
        }
    }

    /** Funzioni a disposizione della pagina come window.MVAndroid */
    private class Bridge {
        @JavascriptInterface
        public void scanBarcode() {
            runOnUiThread(MainActivity.this::startScan);
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String content) {
            runOnUiThread(() -> {
                pendingSave = content;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "application/json" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingSave = null;
                    shareFile(name, content);
                }
            });
        }

        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
            runOnUiThread(() -> openExternal(Uri.parse(url)));
        }

        @JavascriptInterface
        public String readClipboard() {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm == null || !cm.hasPrimaryClip()) return "";
                ClipData clip = cm.getPrimaryClip();
                if (clip == null || clip.getItemCount() == 0) return "";
                CharSequence t = clip.getItemAt(0).coerceToText(MainActivity.this);
                return t == null ? "" : t.toString();
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME;
        }
    }
}

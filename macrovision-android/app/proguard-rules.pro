# Metodi chiamati dalla pagina web (window.MVAndroid)
-keepattributes JavascriptInterface
-keepclassmembers class io.github.renatomecarelli.macrovision.MainActivity$Bridge {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

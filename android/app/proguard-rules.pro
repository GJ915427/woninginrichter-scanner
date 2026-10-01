# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}
-keep public class com.woninginrichter.scanner.** { *; }
-keep public class com.getcapacitor.** { *; }

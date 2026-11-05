package com.vendefrio.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Parcelable;
import android.provider.MediaStore;
import android.app.AlertDialog;
import android.location.LocationManager;
import android.provider.Settings;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;

public class MainActivity extends BridgeActivity {

    // El atrás del celular lo maneja la web (lugar.js), igual que en Chrome:
    // cierra la hoja de arriba o vuelve a la pantalla anterior. Si la web dice
    // que ya está en Inicio sin nada abierto, la app se va al fondo.
    private static final String ATRAS_JS =
        "(function(){try{var l=window.lugarVendeFrio;" +
        "if(l&&l.frenaElAtras&&l.frenaElAtras()){l.atrasDelCelular();return 1;}" +
        "}catch(e){}return 0;})()";

    private ValueCallback<Uri[]> esperandoFoto;
    private Uri fotoNueva;
    private Intent elegirPendiente;
    private ActivityResultLauncher<Intent> elegirFoto;
    private ActivityResultLauncher<String> permisoCamara;
    private ActivityResultLauncher<String[]> permisosInicio;
    private ActivityResultLauncher<String[]> permisosUbicacion;
    private GeolocationPermissions.Callback esperandoUbicacion;
    private String origenUbicacion;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        elegirFoto = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), resultado -> {
            ValueCallback<Uri[]> devolver = esperandoFoto;
            esperandoFoto = null;
            if (devolver == null) return;
            Uri[] elegidas = null;
            if (resultado.getResultCode() == RESULT_OK) {
                Intent datos = resultado.getData();
                if (datos != null && datos.getData() != null) {
                    elegidas = new Uri[] { datos.getData() };
                } else if (datos != null && datos.getClipData() != null && datos.getClipData().getItemCount() > 0) {
                    elegidas = new Uri[] { datos.getClipData().getItemAt(0).getUri() };
                } else if (fotoNueva != null) {
                    elegidas = new Uri[] { fotoNueva };
                }
            }
            devolver.onReceiveValue(elegidas);
        });

        permisoCamara = registerForActivityResult(new ActivityResultContracts.RequestPermission(), concedido -> {
            Intent elegir = elegirPendiente;
            elegirPendiente = null;
            if (elegir == null) return;
            if (!concedido) elegir = soloGaleria();
            lanzarElegir(elegir);
        });

        permisosInicio = registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), r -> {});

        permisosUbicacion = registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), r -> {
            GeolocationPermissions.Callback devolver = esperandoUbicacion;
            String origen = origenUbicacion;
            esperandoUbicacion = null;
            if (devolver == null) return;
            boolean concedido = tieneUbicacion();
            devolver.invoke(origen, concedido, false);
            if (concedido) avisarSiElGpsEstaApagado();
            else ofrecerAjustesSiNoPregunta();
        });

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebChromeClient(new ClienteVendeFrio());
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web == null) {
                    moveTaskToBack(true);
                    return;
                }
                web.evaluateJavascript(ATRAS_JS, valor -> {
                    if ("1".equals(valor)) return;
                    if (web.canGoBack()) web.goBack();
                    else moveTaskToBack(true);
                });
            }
        });

        // Se pide un ratito después, cuando ya se ve la app y no la pantalla de inicio.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().postDelayed(this::pedirUbicacionLaPrimeraVez, 1500);
        }
    }

    private boolean tieneUbicacion() {
        return tiene(Manifest.permission.ACCESS_FINE_LOCATION) || tiene(Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    private boolean gpsPrendido() {
        try {
            LocationManager lugar = (LocationManager) getSystemService(LOCATION_SERVICE);
            return lugar == null || lugar.isProviderEnabled(LocationManager.GPS_PROVIDER) || lugar.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception error) {
            return true;
        }
    }

    // Si la ubicación del celular está apagada, se ofrece prenderla.
    private void avisarSiElGpsEstaApagado() {
        if (gpsPrendido() || isFinishing()) return;
        new AlertDialog.Builder(this)
            .setTitle("La ubicación está apagada")
            .setMessage("Prendela para que VendeFrío sepa dónde estás.")
            .setPositiveButton("Prender", (d, w) -> abrir(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)))
            .setNegativeButton("Ahora no", null)
            .show();
    }

    // Si Android ya no muestra la pregunta (dijo que no dos veces), se ofrece ir a Ajustes.
    private void ofrecerAjustesSiNoPregunta() {
        if (isFinishing()) return;
        if (shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) return;
        new AlertDialog.Builder(this)
            .setTitle("Falta el permiso de ubicación")
            .setMessage("Para ver dónde estás, en Ajustes tocá Permisos › Ubicación › Permitir.")
            .setPositiveButton("Ir a Ajustes", (d, w) -> abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))))
            .setNegativeButton("Ahora no", null)
            .show();
    }

    private void abrir(Intent intent) {
        try {
            startActivity(intent);
        } catch (Exception error) {
            // nada
        }
    }

    // La primera vez que se abre la app pide la ubicación (Rutas, Cerca,
    // Inicio). Si la persona dice que no, no se vuelve a insistir acá: la web
    // la pide de nuevo cuando la necesita.
    private void pedirUbicacionLaPrimeraVez() {
        SharedPreferences preferencias = getSharedPreferences("vendefrio_app", MODE_PRIVATE);
        if (preferencias.getBoolean("ubicacionPedida", false)) return;
        preferencias.edit().putBoolean("ubicacionPedida", true).apply();
        if (tieneUbicacion()) {
            avisarSiElGpsEstaApagado();
            return;
        }
        permisosInicio.launch(new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION });
    }

    private boolean tiene(String permiso) {
        return ContextCompat.checkSelfPermission(this, permiso) == PackageManager.PERMISSION_GRANTED;
    }

    private Intent soloGaleria() {
        Intent galeria = new Intent(Intent.ACTION_GET_CONTENT);
        galeria.addCategory(Intent.CATEGORY_OPENABLE);
        galeria.setType("image/*");
        return Intent.createChooser(galeria, "Elegí una foto");
    }

    // "Sacar foto" o "Elegir de la galería" en el mismo menú, como en Chrome.
    private Intent camaraOGaleria(boolean soloCamara) {
        fotoNueva = null;
        Intent camara = null;
        try {
            File carpeta = new File(getCacheDir(), "fotos");
            if (!carpeta.exists()) carpeta.mkdirs();
            File archivo = File.createTempFile("foto_", ".jpg", carpeta);
            fotoNueva = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", archivo);
            camara = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            camara.putExtra(MediaStore.EXTRA_OUTPUT, fotoNueva);
            camara.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception error) {
            camara = null;
        }
        if (camara == null) return soloGaleria();
        if (soloCamara) return camara;
        Intent galeria = new Intent(Intent.ACTION_GET_CONTENT);
        galeria.addCategory(Intent.CATEGORY_OPENABLE);
        galeria.setType("image/*");
        Intent elegir = Intent.createChooser(galeria, "Sacar o elegir foto");
        elegir.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Parcelable[] { camara });
        return elegir;
    }

    private void lanzarElegir(Intent elegir) {
        try {
            elegirFoto.launch(elegir);
        } catch (Exception error) {
            ValueCallback<Uri[]> devolver = esperandoFoto;
            esperandoFoto = null;
            if (devolver != null) devolver.onReceiveValue(null);
        }
    }

    private class ClienteVendeFrio extends BridgeWebChromeClient {
        ClienteVendeFrio() {
            super(getBridge());
        }

        // La web pide la ubicación: se pregunta con el cartel de Android y,
        // si el GPS está apagado o Android ya no pregunta, se ofrece arreglarlo.
        @Override
        public void onGeolocationPermissionsShowPrompt(String origen, GeolocationPermissions.Callback callback) {
            if (tieneUbicacion()) {
                callback.invoke(origen, true, false);
                avisarSiElGpsEstaApagado();
                return;
            }
            if (esperandoUbicacion != null) esperandoUbicacion.invoke(origenUbicacion, false, false);
            esperandoUbicacion = callback;
            origenUbicacion = origen;
            permisosUbicacion.launch(new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION });
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
            String[] tipos = params.getAcceptTypes();
            boolean imagen = false;
            if (tipos != null) for (String tipo : tipos) if (tipo != null && tipo.startsWith("image")) imagen = true;
            if (!imagen) return super.onShowFileChooser(webView, callback, params);

            if (esperandoFoto != null) esperandoFoto.onReceiveValue(null);
            esperandoFoto = callback;
            Intent elegir = camaraOGaleria(params.isCaptureEnabled());
            if (fotoNueva != null && !tiene(Manifest.permission.CAMERA)) {
                elegirPendiente = elegir;
                permisoCamara.launch(Manifest.permission.CAMERA);
            } else {
                lanzarElegir(elegir);
            }
            return true;
        }
    }
}

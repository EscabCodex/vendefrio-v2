package com.vendefrio.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// La notificación de la navegación: la indicación (flecha, metros y calle),
// "Parada 3 de 8 · comercio · llegás 8:51", la barra de paradas hechas y los
// botones "Cargar pedido" y "Sin pedido". Usa el mismo número que la
// notificación fija del GPS en segundo plano, así es una sola y no se puede
// sacar deslizando hasta que se termina la ruta.
@CapacitorPlugin(name = "NotificacionReparto")
public class NotificacionReparto extends Plugin {

    static final int ID = 28351;
    static final String CANAL = "reparto";
    static final String EXTRA = "accionReparto";
    private static final int COLOR = 0xFF0B8A82;
    private static NotificacionReparto activo;

    private String flechaDibujada = "";
    private Bitmap flecha;

    @Override
    public void load() {
        activo = this;
        crearCanal(getContext());
    }

    // MainActivity (Cargar pedido, tocar la notificación) y ReceptorReparto
    // (Sin pedido) avisan a la web. Si la web todavía no escucha, el aviso
    // queda guardado hasta que escuche.
    static void avisar(String accion) {
        if (activo == null || accion == null) return;
        JSObject datos = new JSObject();
        datos.put("accion", accion);
        activo.notifyListeners("accion", datos, true);
    }

    static void crearCanal(Context contexto) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = contexto.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canal = new NotificationChannel(CANAL, "Reparto en curso", NotificationManager.IMPORTANCE_LOW);
        canal.setDescription("Por qué parada vas");
        canal.enableVibration(false);
        canal.setShowBadge(false);
        manager.createNotificationChannel(canal);
    }

    @PluginMethod
    public void mostrar(PluginCall call) {
        Context contexto = getContext();
        String titulo = call.getString("titulo", "Repartiendo");
        String texto = call.getString("texto", "");
        String detalle = call.getString("detalle", "");
        int hechas = Math.max(0, call.getInt("hechas", 0));
        int total = Math.max(0, call.getInt("total", 0));
        boolean botones = Boolean.TRUE.equals(call.getBoolean("botones", true));
        boolean sinPedido = Boolean.TRUE.equals(call.getBoolean("sinPedido", true));
        String flechaPedida = call.getString("flecha", "giro");
        int color = COLOR;
        try {
            String elegido = call.getString("color", "");
            if (elegido != null && !elegido.isEmpty()) color = Color.parseColor(elegido);
        } catch (IllegalArgumentException error) {
            color = COLOR;
        }

        NotificationCompat.Builder armado = new NotificationCompat.Builder(contexto, CANAL)
            .setSmallIcon(R.drawable.ic_stat_copo)
            // Fondo entero del color de la app (Apariencia). Android lo deja
            // en las notificaciones fijas de un servicio, como esta.
            .setColor(color)
            .setColorized(true)
            .setSubText("ninguna".equals(flechaPedida) ? "Repartiendo" : "Navegación")
            .setContentTitle(titulo)
            .setContentText(detalle.isEmpty() ? texto : detalle)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(alActivity(contexto, "abrir", 1));

        if (!"ninguna".equals(flechaPedida)) armado.setLargeIcon(dibujarFlecha(flechaPedida, call.getInt("grados", 0)));
        String largo = texto.isEmpty() ? detalle : (detalle.isEmpty() ? texto : texto + "\n" + detalle);
        armado.setStyle(new NotificationCompat.BigTextStyle().bigText(largo));
        if (total > 0) armado.setProgress(total, Math.min(hechas, total), false);
        if (botones) {
            armado.addAction(0, "Cargar pedido", alActivity(contexto, "cargar", 2));
        }
        if (botones && sinPedido) {
            Intent tocoSinPedido = new Intent(contexto, ReceptorReparto.class).setAction("com.vendefrio.app.SIN_PEDIDO");
            armado.addAction(0, "Sin pedido", PendingIntent.getBroadcast(contexto, 3, tocoSinPedido, banderas()));
        }

        try {
            crearCanal(contexto);
            NotificationManagerCompat.from(contexto).notify(ID, armado.build());
            call.resolve();
        } catch (SecurityException error) {
            call.reject("Falta el permiso de notificaciones");
        }
    }

    @PluginMethod
    public void quitar(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(ID);
        call.resolve();
    }

    private static int banderas() {
        int banderas = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) banderas |= PendingIntent.FLAG_IMMUTABLE;
        return banderas;
    }

    private static PendingIntent alActivity(Context contexto, String accion, int numero) {
        Intent abrir = new Intent(contexto, MainActivity.class)
            .setAction("com.vendefrio.app.REPARTO_" + accion)
            .putExtra(EXTRA, accion)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(contexto, numero, abrir, banderas());
    }

    // Cuadradito claro con la flecha de la maniobra, como en la pantalla de
    // navegación: una sola flecha girada, la bandera al llegar o la rotonda.
    private Bitmap dibujarFlecha(String tipo, int grados) {
        String clave = tipo + grados;
        if (flecha != null && clave.equals(flechaDibujada)) return flecha;
        float densidad = getContext().getResources().getDisplayMetrics().density;
        int lado = Math.round(64 * densidad);
        Bitmap dibujo = Bitmap.createBitmap(lado, lado, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(dibujo);
        Paint fondo = new Paint(Paint.ANTI_ALIAS_FLAG);
        fondo.setColor(0xFFE3F2F0);
        lienzo.drawRoundRect(new RectF(0, 0, lado, lado), lado * 0.25f, lado * 0.25f, fondo);

        Paint trazo = new Paint(Paint.ANTI_ALIAS_FLAG);
        trazo.setColor(0xFF0B615F);
        trazo.setStyle(Paint.Style.STROKE);
        trazo.setStrokeCap(Paint.Cap.ROUND);
        trazo.setStrokeJoin(Paint.Join.ROUND);
        trazo.setStrokeWidth(lado * 0.09f);
        float c = lado / 2f;
        float u = lado / 24f * 0.62f;

        lienzo.save();
        lienzo.translate(c, c);
        if ("llegada".equals(tipo)) {
            // Bandera
            Path asta = new Path();
            asta.moveTo(-6 * u, 9 * u);
            asta.lineTo(-6 * u, -9 * u);
            lienzo.drawPath(asta, trazo);
            Path tela = new Path();
            tela.moveTo(-6 * u, -9 * u);
            tela.lineTo(7 * u, -5.5f * u);
            tela.lineTo(-6 * u, -1 * u);
            tela.close();
            Paint relleno = new Paint(trazo);
            relleno.setStyle(Paint.Style.FILL_AND_STROKE);
            lienzo.drawPath(tela, relleno);
        } else if ("rotonda".equals(tipo)) {
            lienzo.drawArc(new RectF(-7 * u, -7 * u, 7 * u, 7 * u), -60, 300, false, trazo);
            Path punta = new Path();
            punta.moveTo(1 * u, -10 * u);
            punta.lineTo(4.5f * u, -6 * u);
            punta.lineTo(0.5f * u, -3.5f * u);
            lienzo.drawPath(punta, trazo);
        } else {
            lienzo.rotate(grados);
            Path flechaRecta = new Path();
            flechaRecta.moveTo(0, 8 * u);
            flechaRecta.lineTo(0, -7 * u);
            flechaRecta.moveTo(-6 * u, -1 * u);
            flechaRecta.lineTo(0, -7 * u);
            flechaRecta.lineTo(6 * u, -1 * u);
            lienzo.drawPath(flechaRecta, trazo);
        }
        lienzo.restore();
        flecha = dibujo;
        flechaDibujada = clave;
        return dibujo;
    }
}

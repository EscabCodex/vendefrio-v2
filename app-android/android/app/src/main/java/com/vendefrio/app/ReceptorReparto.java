package com.vendefrio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// "Sin pedido" en la notificación de la navegación: deja el comercio como
// visitado y pasa a la parada que sigue, sin abrir la app.
public class ReceptorReparto extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexto, Intent intent) {
        NotificacionReparto.avisar("sinPedido");
    }
}

module.exports = function handler(request, response) {
    const key = process.env.MAPTILER_KEY || "";

    if (!key) {
        response.status(503).json({
            ok: false,
            message: "Falta configurar MAPTILER_KEY en Vercel."
        });
        return;
    }

    response.status(200).json({
        ok: true,
        key
    });
};

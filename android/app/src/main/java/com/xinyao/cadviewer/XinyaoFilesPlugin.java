package com.xinyao.cadviewer;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "XinyaoFiles")
public class XinyaoFilesPlugin extends Plugin {
    static final long LIMIT_BYTES = 96L * 1024L * 1024L;

    private static XinyaoFilesPlugin instance;
    private static Pending pending;

    static final class Pending {
        final String name;
        final String path;
        final String error;

        Pending(String name, String path, String error) {
            this.name = name;
            this.path = path;
            this.error = error;
        }
    }

    @Override
    public void load() {
        instance = this;
        if (pending != null && hasListeners("drawing")) {
            notifyDrawing(pending);
            pending = null;
        }
    }

    @SuppressWarnings("deprecation")
    public static void deliver(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            if (Build.VERSION.SDK_INT >= 33) {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            } else {
                uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            }
        }
        if (uri == null) return;
        try {
            publish(importUri(context, uri));
        } catch (MemoryException exception) {
            publish(new Pending("", "", "out of memory"));
        } catch (IllegalArgumentException exception) {
            // Another app offered a file that is not .dwg/.dxf. Stay quiet.
        } catch (Exception exception) {
            publish(new Pending("", "", "open"));
        }
    }

    private static void publish(Pending imported) {
        pending = imported;
        if (instance != null && instance.hasListeners("drawing")) {
            instance.notifyDrawing(imported);
            pending = null;
        }
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(
            Intent.EXTRA_MIME_TYPES,
            new String[] {
                "application/acad",
                "application/x-acad",
                "application/dwg",
                "application/x-dwg",
                "image/vnd.dwg",
                "image/vnd.dxf",
                "application/dxf",
                "application/x-dxf",
                "application/octet-stream",
                "*/*"
            }
        );
        startActivityForResult(call, intent, "onPick");
    }

    @ActivityCallback
    private void onPick(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject canceled = new JSObject();
            canceled.put("canceled", true);
            call.resolve(canceled);
            return;
        }
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception ignored) {
            // A one-shot grant is enough to copy the bytes.
        }
        try {
            Pending imported = importUri(getContext(), uri);
            JSObject ret = new JSObject();
            ret.put("canceled", false);
            ret.put("name", imported.name);
            ret.put("path", imported.path);
            call.resolve(ret);
        } catch (MemoryException exception) {
            call.reject("out of memory");
        } catch (IllegalArgumentException exception) {
            call.reject("unsupported type");
        } catch (Exception exception) {
            call.reject(exception.getMessage() == null ? "open" : exception.getMessage());
        }
    }

    @PluginMethod
    public void consumePending(PluginCall call) {
        Pending current = pending;
        pending = null;
        JSObject ret = new JSObject();
        if (current == null) {
            ret.put("empty", true);
        } else if (current.error != null && !current.error.isEmpty()) {
            ret.put("empty", true);
            ret.put("error", current.error);
        } else {
            ret.put("empty", false);
            ret.put("name", current.name);
            ret.put("path", current.path);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void share(PluginCall call) {
        String name = call.getString("name");
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("dataBase64");
        if (name == null || data == null) {
            call.reject("missing");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            File dir = new File(getContext().getCacheDir(), "export");
            if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cache");
            File out = new File(dir, sanitize(name));
            try (FileOutputStream stream = new FileOutputStream(out)) {
                stream.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                out
            );
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri(name, uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, Intent.createChooser(send, name), "onShare");
        } catch (Exception exception) {
            call.reject(exception.getMessage() == null ? "share" : exception.getMessage());
        }
    }

    @ActivityCallback
    private void onShare(PluginCall call, ActivityResult result) {
        if (call != null) call.resolve();
    }

    private void notifyDrawing(Pending imported) {
        JSObject payload = new JSObject();
        if (imported.error != null && !imported.error.isEmpty()) {
            payload.put("error", imported.error);
        } else {
            payload.put("name", imported.name);
            payload.put("path", imported.path);
        }
        notifyListeners("drawing", payload);
    }

    static Pending importUri(Context context, Uri uri) throws Exception {
        String name = displayName(context, uri);
        if (!isDrawingName(name)) {
            String extension = extensionFromMime(context, uri);
            if (extension == null) throw new IllegalArgumentException("unsupported type");
            String stem = name == null || name.isEmpty() ? "drawing" : name;
            name = stem + extension;
        }
        File dir = new File(context.getCacheDir(), "inbox");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cache");
        File dest = new File(dir, UUID.randomUUID() + "-" + sanitize(new File(name).getName()));
        try (InputStream input = context.getContentResolver().openInputStream(uri);
             FileOutputStream output = new FileOutputStream(dest)) {
            if (input == null) throw new IllegalStateException("empty");
            byte[] buffer = new byte[64 * 1024];
            long total = 0;
            int read;
            while ((read = input.read(buffer)) >= 0) {
                total += read;
                if (total > LIMIT_BYTES) {
                    dest.delete();
                    throw new MemoryException();
                }
                if (read > 0) output.write(buffer, 0, read);
            }
        }
        return new Pending(new File(name).getName(), dest.getAbsolutePath(), "");
    }

    private static String displayName(Context context, Uri uri) {
        try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0 && cursor.moveToFirst()) {
                    String value = cursor.getString(index);
                    if (value != null && !value.isEmpty()) return value;
                }
            }
        } catch (Exception ignored) {
            // Fall through to the URI path.
        }
        String path = uri.getLastPathSegment();
        return path == null ? "" : path;
    }

    private static boolean isDrawingName(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase(Locale.US);
        return lower.endsWith(".dwg") || lower.endsWith(".dxf");
    }

    private static String extensionFromMime(Context context, Uri uri) {
        String mime = context.getContentResolver().getType(uri);
        if (mime == null) return null;
        String lower = mime.toLowerCase(Locale.US);
        if (lower.contains("dxf")) return ".dxf";
        if (lower.contains("dwg") || lower.contains("acad")) return ".dwg";
        return null;
    }

    private static String sanitize(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (cleaned.isEmpty()) return "drawing";
        return cleaned.length() > 120 ? cleaned.substring(cleaned.length() - 120) : cleaned;
    }

    static final class MemoryException extends Exception {}
}

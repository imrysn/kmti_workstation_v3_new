$path = $args[0]
$outPath = $args[1]
$size = [int]$args[2]

$code = @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Drawing.Imaging;

public class ThumbnailExtractor {
    [ComImport]
    [Guid("BCC18210-4834-4531-9A95-96A199BBC512")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItemImageFactory {
        [PreserveSig]
        int GetImage(SIZE size, int flags, out IntPtr phbm);
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct SIZE {
        public int cx;
        public int cy;
        public SIZE(int cx, int cy) { this.cx = cx; this.cy = cy; }
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(string pszPath, IntPtr pbc, [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid, out IShellItemImageFactory ppv);

    [DllImport("gdi32.dll")]
    public static extern bool DeleteObject(IntPtr hObject);

    public static void SaveThumbnail(string path, string outPath, int size) {
        IShellItemImageFactory factory;
        Guid guid = new Guid("BCC18210-4834-4531-9A95-96A199BBC512");
        SHCreateItemFromParsingName(path, IntPtr.Zero, guid, out factory);
        IntPtr hBitmap;
        // SIIGBF_RESIZETOFIT = 0x0
        int hr = factory.GetImage(new SIZE(size, size), 0x0, out hBitmap);
        if (hr != 0) {
            // Try SIIGBF_ICONONLY fallback
            hr = factory.GetImage(new SIZE(size, size), 0x1, out hBitmap);
        }
        
        if (hr == 0 && hBitmap != IntPtr.Zero) {
            using (Bitmap bmp = Bitmap.FromHbitmap(hBitmap)) {
                bmp.Save(outPath, ImageFormat.Png);
            }
            DeleteObject(hBitmap);
        } else {
            throw new Exception("Failed to get image, HRESULT: " + hr);
        }
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
[ThumbnailExtractor]::SaveThumbnail($path, $outPath, $size)

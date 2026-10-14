using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Security;
using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading;

namespace ThoenSmartCardBridge
{
    [StructLayout(LayoutKind.Sequential)]
    public struct SCARD_IO_REQUEST
    {
        public uint dwProtocol;
        public uint cbPciLength;
    }

    public class PcscInterop
    {
        [DllImport("winscard.dll")]
        public static extern int SCardEstablishContext(uint dwScope, IntPtr pvReserved1, IntPtr pvReserved2, out IntPtr phContext);

        [DllImport("winscard.dll", EntryPoint = "SCardListReadersA", CharSet = CharSet.Ansi)]
        public static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref int pcchReaders);

        [DllImport("winscard.dll", EntryPoint = "SCardConnectA", CharSet = CharSet.Ansi)]
        public static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

        [DllImport("winscard.dll")]
        public static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

        [DllImport("winscard.dll")]
        public static extern int SCardReleaseContext(IntPtr hContext);

        [DllImport("winscard.dll")]
        public static extern int SCardTransmit(IntPtr hCard, ref SCARD_IO_REQUEST pioSendPci, byte[] pbSendBuffer, int cbSendLength, IntPtr pioRecvPci, byte[] pbRecvBuffer, ref int pcbRecvLength);

        public const uint SCARD_SCOPE_USER = 0;
        public const uint SCARD_SHARE_SHARED = 2;
        public const uint SCARD_PROTOCOL_T0 = 1;
        public const uint SCARD_PROTOCOL_T1 = 2;
        public const uint SCARD_LEAVE_CARD = 0;
    }

    public class CardReader
    {
        private static readonly object cardLock = new object();

        // Thai National ID APDU commands
        private static byte[] APDU_SELECT_APPLET = new byte[] { 0x00, 0xA4, 0x04, 0x00, 0x08, 0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01 };
        private static byte[] APDU_READ_CID = new byte[] { 0x80, 0xB0, 0x00, 0x04, 0x02, 0x00, 0x0D };
        private static byte[] APDU_READ_NAME_TH = new byte[] { 0x80, 0xB0, 0x00, 0x11, 0x02, 0x00, 0x64 };
        private static byte[] APDU_READ_NAME_EN = new byte[] { 0x80, 0xB0, 0x00, 0x75, 0x02, 0x00, 0x64 };
        private static byte[] APDU_READ_DOB = new byte[] { 0x80, 0xB0, 0x00, 0xD9, 0x02, 0x00, 0x08 };
        private static byte[] APDU_READ_GENDER = new byte[] { 0x80, 0xB0, 0x00, 0xE1, 0x02, 0x00, 0x01 };
        private static byte[] APDU_READ_ISSUER = new byte[] { 0x80, 0xB0, 0x00, 0xF6, 0x02, 0x00, 0x64 };
        private static byte[] APDU_READ_ISSUE_DATE = new byte[] { 0x80, 0xB0, 0x01, 0x67, 0x02, 0x00, 0x08 };
        private static byte[] APDU_READ_EXP_DATE = new byte[] { 0x80, 0xB0, 0x01, 0x6F, 0x02, 0x00, 0x08 };
        private static byte[] APDU_READ_ADDRESS = new byte[] { 0x80, 0xB0, 0x15, 0x79, 0x02, 0x00, 0x64 };

        private static byte[][] PHOTO_APDUS = new byte[][] {
            new byte[] { 0x80, 0xB0, 0x01, 0x7B, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x02, 0x79, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x03, 0x77, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x04, 0x75, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x05, 0x73, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x06, 0x71, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x07, 0x6F, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x08, 0x6D, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x09, 0x6B, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x0A, 0x69, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x0B, 0x67, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x0C, 0x65, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x0D, 0x63, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x0E, 0x61, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x0F, 0x5F, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x10, 0x5D, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x11, 0x5B, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x12, 0x59, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x13, 0x57, 0x02, 0x00, 0xFE },
            new byte[] { 0x80, 0xB0, 0x14, 0x55, 0x02, 0x00, 0xFE }
        };

        public static byte[] SendApdu(IntPtr hCard, ref SCARD_IO_REQUEST pci, byte[] apdu)
        {
            // Pacing delay (10ms) to ensure reader buffer and smart card chip synchronization
            Thread.Sleep(10);

            for (int attempt = 0; attempt < 2; attempt++)
            {
                byte[] recv = new byte[300];
                int recvLen = recv.Length;
                int ret = PcscInterop.SCardTransmit(hCard, ref pci, apdu, apdu.Length, IntPtr.Zero, recv, ref recvLen);
                if (ret != 0)
                {
                    Thread.Sleep(20);
                    continue;
                }

                if (recvLen == 2 && recv[0] == 0x61)
                {
                    byte le = recv[1];
                    byte[] getResponse = new byte[] { 0x00, 0xC0, 0x00, 0x00, le };
                    recvLen = recv.Length;
                    ret = PcscInterop.SCardTransmit(hCard, ref pci, getResponse, getResponse.Length, IntPtr.Zero, recv, ref recvLen);
                    if (ret == 0 && recvLen >= 2 && recv[recvLen - 2] == 0x90 && recv[recvLen - 1] == 0x00)
                    {
                        byte[] data = new byte[recvLen - 2];
                        Array.Copy(recv, 0, data, 0, recvLen - 2);
                        return data;
                    }
                }
                else if (recvLen == 2 && recv[0] == 0x6C)
                {
                    byte correctLe = recv[1];
                    byte[] retryApdu = (byte[])apdu.Clone();
                    retryApdu[retryApdu.Length - 1] = correctLe;
                    recvLen = recv.Length;
                    ret = PcscInterop.SCardTransmit(hCard, ref pci, retryApdu, retryApdu.Length, IntPtr.Zero, recv, ref recvLen);
                    if (ret == 0 && recvLen >= 2 && recv[recvLen - 2] == 0x90 && recv[recvLen - 1] == 0x00)
                    {
                        byte[] data = new byte[recvLen - 2];
                        Array.Copy(recv, 0, data, 0, recvLen - 2);
                        return data;
                    }
                }
                else if (recvLen >= 2 && recv[recvLen - 2] == 0x90 && recv[recvLen - 1] == 0x00)
                {
                    byte[] data = new byte[recvLen - 2];
                    Array.Copy(recv, 0, data, 0, recvLen - 2);
                    return data;
                }

                Thread.Sleep(20);
            }

            return new byte[0];
        }

        public static string GetActiveReader(IntPtr hContext)
        {
            lock (cardLock)
            {
                try
                {
                    int chars = 2048;
                    byte[] readers = new byte[chars];
                    int ret = PcscInterop.SCardListReaders(hContext, null, readers, ref chars);
                    if (ret != 0 || chars <= 1) return null;
                    string raw = Encoding.ASCII.GetString(readers, 0, chars);
                    string[] parts = raw.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
                    return parts.Length > 0 ? parts[0] : null;
                }
                catch
                {
                    return null;
                }
            }
        }

        public static bool CheckCardPresent(IntPtr hContext, string readerName)
        {
            if (string.IsNullOrEmpty(readerName)) return false;
            lock (cardLock)
            {
                try
                {
                    IntPtr hCard = IntPtr.Zero;
                    uint proto = 0;
                    int ret = PcscInterop.SCardConnect(hContext, readerName, PcscInterop.SCARD_SHARE_SHARED, PcscInterop.SCARD_PROTOCOL_T0 | PcscInterop.SCARD_PROTOCOL_T1, out hCard, out proto);
                    if (ret == 0)
                    {
                        PcscInterop.SCardDisconnect(hCard, PcscInterop.SCARD_LEAVE_CARD);
                        return true;
                    }
                }
                catch
                {
                }
                return false;
            }
        }

        public static string DecodeTis620(byte[] bytes)
        {
            if (bytes == null || bytes.Length == 0) return "";
            try
            {
                Encoding enc = Encoding.GetEncoding(874);
                return enc.GetString(bytes).Replace("\0", "").Trim();
            }
            catch
            {
                return Encoding.UTF8.GetString(bytes).Replace("\0", "").Trim();
            }
        }

        public static Dictionary<string, object> ReadCardData(IntPtr hContext, string readerName)
        {
            if (string.IsNullOrEmpty(readerName)) return null;

            lock (cardLock)
            {
                // Retry up to 3 times to handle contact bounce or temporary bus busy
                for (int attempt = 1; attempt <= 3; attempt++)
                {
                    IntPtr hCard = IntPtr.Zero;
                    uint activeProtocol = 0;
                    int ret = PcscInterop.SCardConnect(hContext, readerName, PcscInterop.SCARD_SHARE_SHARED, PcscInterop.SCARD_PROTOCOL_T0 | PcscInterop.SCARD_PROTOCOL_T1, out hCard, out activeProtocol);
                    if (ret != 0)
                    {
                        Thread.Sleep(150);
                        continue;
                    }

                    try
                    {
                        SCARD_IO_REQUEST pci = new SCARD_IO_REQUEST();
                        pci.dwProtocol = activeProtocol;
                        pci.cbPciLength = (uint)Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

                        // 1. Select Thai National ID Applet
                        byte[] selectResp = SendApdu(hCard, ref pci, APDU_SELECT_APPLET);

                        // 2. Read CID (13 bytes)
                        byte[] cidBytes = SendApdu(hCard, ref pci, APDU_READ_CID);
                        string cid = DecodeTis620(cidBytes);
                        if (string.IsNullOrEmpty(cid) || cid.Length < 13)
                        {
                            Thread.Sleep(150);
                            continue;
                        }

                        // 3. Read Full Name TH
                        byte[] nameThBytes = SendApdu(hCard, ref pci, APDU_READ_NAME_TH);
                        string rawNameTh = DecodeTis620(nameThBytes);
                        string[] nameThParts = rawNameTh.Split(new char[] { '#' }, StringSplitOptions.None);
                        string titleTh = nameThParts.Length > 0 ? nameThParts[0].Trim() : "";
                        string firstNameTh = nameThParts.Length > 1 ? nameThParts[1].Trim() : "";
                        string middleNameTh = nameThParts.Length > 2 ? nameThParts[2].Trim() : "";
                        string lastNameTh = nameThParts.Length > 3 ? nameThParts[3].Trim() : "";
                        string fullNameTh = (titleTh + " " + firstNameTh + (middleNameTh != "" ? " " + middleNameTh : "") + " " + lastNameTh).Trim();

                        // Crucial verification: Thai ID chip must yield a non-empty Thai full name!
                        // If empty, the read was partial/glitched. Do NOT return partial data; retry!
                        if (string.IsNullOrEmpty(fullNameTh))
                        {
                            Thread.Sleep(150);
                            continue;
                        }

                        // 4. Read Full Name EN
                        byte[] nameEnBytes = SendApdu(hCard, ref pci, APDU_READ_NAME_EN);
                        string rawNameEn = DecodeTis620(nameEnBytes);
                        string[] nameEnParts = rawNameEn.Split(new char[] { '#' }, StringSplitOptions.None);
                        string titleEn = nameEnParts.Length > 0 ? nameEnParts[0].Trim() : "";
                        string firstNameEn = nameEnParts.Length > 1 ? nameEnParts[1].Trim() : "";
                        string middleNameEn = nameEnParts.Length > 2 ? nameEnParts[2].Trim() : "";
                        string lastNameEn = nameEnParts.Length > 3 ? nameEnParts[3].Trim() : "";
                        string fullNameEn = (titleEn + " " + firstNameEn + (middleNameEn != "" ? " " + middleNameEn : "") + " " + lastNameEn).Trim();

                        // 5. Read Date of Birth (YYYYMMDD)
                        byte[] dobBytes = SendApdu(hCard, ref pci, APDU_READ_DOB);
                        string rawDob = DecodeTis620(dobBytes);
                        string birthDate = "";
                        if (rawDob.Length >= 8)
                        {
                            birthDate = rawDob.Substring(0, 4) + "-" + rawDob.Substring(4, 2) + "-" + rawDob.Substring(6, 2);
                        }

                        // 6. Read Gender (1 = Male, 2 = Female)
                        byte[] genderBytes = SendApdu(hCard, ref pci, APDU_READ_GENDER);
                        string rawGender = DecodeTis620(genderBytes);
                        string gender = "ไม่ระบุ";
                        if (rawGender == "1") gender = "ชาย";
                        else if (rawGender == "2") gender = "หญิง";

                        // 7. Read Address
                        byte[] addrBytes = SendApdu(hCard, ref pci, APDU_READ_ADDRESS);
                        string rawAddr = DecodeTis620(addrBytes);
                        string address = rawAddr.Replace("#", " ").Trim();

                        // 8. Read Issuer, Issue Date, Expire Date
                        string issuer = DecodeTis620(SendApdu(hCard, ref pci, APDU_READ_ISSUER));
                        string issueDate = DecodeTis620(SendApdu(hCard, ref pci, APDU_READ_ISSUE_DATE));
                        string expireDate = DecodeTis620(SendApdu(hCard, ref pci, APDU_READ_EXP_DATE));

                        // 9. Read Photo JPEG
                        List<byte> photoBytes = new List<byte>();
                        foreach (var apdu in PHOTO_APDUS)
                        {
                            byte[] chunk = SendApdu(hCard, ref pci, apdu);
                            if (chunk.Length > 0)
                            {
                                photoBytes.AddRange(chunk);
                            }
                        }
                        string photoBase64 = "";
                        if (photoBytes.Count > 100)
                        {
                            photoBase64 = "data:image/jpeg;base64," + Convert.ToBase64String(photoBytes.ToArray());
                        }

                        Dictionary<string, object> data = new Dictionary<string, object>();
                        data["cid"] = cid;
                        data["titleTh"] = titleTh;
                        data["firstNameTh"] = firstNameTh;
                        data["lastNameTh"] = lastNameTh;
                        data["fullNameTh"] = fullNameTh;
                        data["titleEn"] = titleEn;
                        data["firstNameEn"] = firstNameEn;
                        data["lastNameEn"] = lastNameEn;
                        data["fullNameEn"] = fullNameEn;
                        data["birthDate"] = birthDate;
                        data["gender"] = gender;
                        data["address"] = address;
                        data["issuer"] = issuer;
                        data["issueDate"] = issueDate;
                        data["expireDate"] = expireDate;
                        data["photo"] = photoBase64;

                        return data;
                    }
                    finally
                    {
                        PcscInterop.SCardDisconnect(hCard, PcscInterop.SCARD_LEAVE_CARD);
                    }
                }
                return null;
            }
        }
    }

    public static class ClipboardHelper
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool OpenClipboard(IntPtr hWndNewOwner);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool CloseClipboard();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool EmptyClipboard();

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr GlobalLock(IntPtr hMem);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GlobalUnlock(IntPtr hMem);

        private const uint CF_UNICODETEXT = 13;
        private const uint GMEM_MOVEABLE = 0x0002;

        public static bool SetText(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;
            for (int i = 0; i < 15; i++)
            {
                if (OpenClipboard(IntPtr.Zero))
                {
                    try
                    {
                        EmptyClipboard();
                        byte[] bytes = Encoding.Unicode.GetBytes(text + "\0");
                        IntPtr hGlobal = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)bytes.Length);
                        if (hGlobal != IntPtr.Zero)
                        {
                            IntPtr target = GlobalLock(hGlobal);
                            if (target != IntPtr.Zero)
                            {
                                Marshal.Copy(bytes, 0, target, bytes.Length);
                                GlobalUnlock(hGlobal);
                                SetClipboardData(CF_UNICODETEXT, hGlobal);
                                return true;
                            }
                        }
                    }
                    catch { }
                    finally
                    {
                        CloseClipboard();
                    }
                }
                Thread.Sleep(30);
            }
            return false;
        }
    }

    public static class BrowserInjector
    {
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetConsoleWindow();

        [DllImport("kernel32.dll")]
        private static extern uint GetCurrentThreadId();

        [DllImport("user32.dll")]
        private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        private const byte VK_CONTROL = 0x11;
        private const byte VK_V = 0x56;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const int SW_RESTORE = 9;

        public static bool InjectIntoBrowser(string jsonPayload)
        {
            try
            {
                // 1. Put payload on Windows Clipboard
                if (!ClipboardHelper.SetText(jsonPayload))
                {
                    return false;
                }

                // 2. Find target Chrome/Edge window matching screening scan
                IntPtr myConsole = GetConsoleWindow();
                uint myPid = (uint)Process.GetCurrentProcess().Id;
                IntPtr targetHwnd = IntPtr.Zero;

                EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
                {
                    if (hWnd == myConsole) return true; // NEVER match own console!

                    uint pid = 0;
                    GetWindowThreadProcessId(hWnd, out pid);
                    if (pid == 0 || pid == myPid) return true;

                    try
                    {
                        Process p = Process.GetProcessById((int)pid);
                        string procName = p.ProcessName.ToLower();
                        if (procName != "chrome" && procName != "msedge" && procName != "brave" && procName != "opera")
                        {
                            return true; // only consider browsers
                        }
                    }
                    catch
                    {
                        return true;
                    }

                    StringBuilder sb = new StringBuilder(256);
                    GetWindowText(hWnd, sb, 256);
                    string title = sb.ToString();
                    if (!string.IsNullOrEmpty(title))
                    {
                        string lower = title.ToLower();
                        if (lower.Contains("จุดอ่านบัตร") || lower.Contains("คัดกรอง") || lower.Contains("screening") || lower.Contains("thlp.moph.go.th"))
                        {
                            targetHwnd = hWnd;
                            return false; // Found exact match!
                        }
                    }
                    return true;
                }, IntPtr.Zero);

                // If not found by specific title, find any open browser window
                if (targetHwnd == IntPtr.Zero)
                {
                    EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
                    {
                        if (hWnd == myConsole) return true;
                        uint pid = 0;
                        GetWindowThreadProcessId(hWnd, out pid);
                        if (pid == 0 || pid == myPid) return true;
                        try
                        {
                            Process p = Process.GetProcessById((int)pid);
                            string procName = p.ProcessName.ToLower();
                            if (procName == "chrome" || procName == "msedge")
                            {
                                StringBuilder sb = new StringBuilder(256);
                                GetWindowText(hWnd, sb, 256);
                                string title = sb.ToString();
                                if (!string.IsNullOrEmpty(title) && !title.StartsWith("Chrome Legacy Window"))
                                {
                                    targetHwnd = hWnd;
                                    return false;
                                }
                            }
                        }
                        catch { }
                        return true;
                    }, IntPtr.Zero);
                }

                if (targetHwnd != IntPtr.Zero)
                {
                    IntPtr foreWnd = GetForegroundWindow();
                    if (foreWnd != targetHwnd)
                    {
                        uint dummyPid = 0;
                        uint foreThread = GetWindowThreadProcessId(foreWnd, out dummyPid);
                        uint currentThread = GetCurrentThreadId();
                        AttachThreadInput(currentThread, foreThread, true);
                        ShowWindow(targetHwnd, SW_RESTORE);
                        SetForegroundWindow(targetHwnd);
                        AttachThreadInput(currentThread, foreThread, false);
                        Thread.Sleep(80);
                    }

                    // Send Ctrl+V directly to browser window
                    keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
                    keybd_event(VK_V, 0, 0, UIntPtr.Zero);
                    keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                    keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                    return true;
                }
            }
            catch { }
            return false;
        }
    }

    public class CloudBridgeClient
    {
        public static string[] TargetEndpoints = new string[] {
            "https://thlp.moph.go.th/api/service/screening/bridge-push"
        };
        public const string SecretToken = "thoen-smartcard-bridge-secret-2026";
        public static string StationId = "1";
        private static string activeUrl = null;

        static CloudBridgeClient()
        {
            try
            {
                // Force TLS 1.2 and bypass SSL validation for hospital proxies
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072 | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls;
                ServicePointManager.ServerCertificateValidationCallback = delegate(object sender, X509Certificate certificate, X509Chain chain, SslPolicyErrors sslPolicyErrors)
                {
                    return true;
                };
            }
            catch { }
        }

        public static bool SendPush(string action, string readerName, bool cardPresent, Dictionary<string, object> cardData)
        {
            if (!string.IsNullOrEmpty(activeUrl))
            {
                if (TryPostTo(activeUrl, action, readerName, cardPresent, cardData))
                {
                    return true;
                }
                activeUrl = null;
            }

            foreach (string url in TargetEndpoints)
            {
                if (TryPostTo(url, action, readerName, cardPresent, cardData))
                {
                    activeUrl = url;
                    return true;
                }
            }

            return false;
        }

        private static bool TryPostTo(string url, string action, string readerName, bool cardPresent, Dictionary<string, object> cardData)
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(url);
                req.Method = "POST";
                req.ContentType = "application/json; charset=utf-8";
                req.Headers.Add("x-bridge-token", SecretToken);
                req.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 ThoenBridge/2.0";
                req.Timeout = 2500;
                req.ReadWriteTimeout = 2500;

                StringBuilder sb = new StringBuilder();
                sb.Append("{");
                sb.AppendFormat("\"station\":\"{0}\",", StationId.Replace("\"", "\\\""));
                sb.AppendFormat("\"action\":\"{0}\",", action);
                sb.AppendFormat("\"reader\":\"{0}\",", (readerName ?? "None").Replace("\\", "\\\\").Replace("\"", "\\\""));
                sb.AppendFormat("\"cardPresent\":{0}", cardPresent ? "true" : "false");

                if (cardData != null)
                {
                    sb.Append(",\"card\":{");
                    bool first = true;
                    foreach (var kv in cardData)
                    {
                        if (!first) sb.Append(",");
                        string val = kv.Value != null ? kv.Value.ToString() : "";
                        sb.AppendFormat("\"{0}\":\"{1}\"", kv.Key, val.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n"));
                        first = false;
                    }
                    sb.Append("}");
                }
                sb.Append("}");

                byte[] data = Encoding.UTF8.GetBytes(sb.ToString());
                req.ContentLength = data.Length;

                using (Stream stream = req.GetRequestStream())
                {
                    stream.Write(data, 0, data.Length);
                }

                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }
    }

    class Program
    {
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetConsoleCtrlHandler(ConsoleCtrlDelegate HandlerRoutine, bool Add);

        private delegate bool ConsoleCtrlDelegate(uint dwCtrlType);
        private static ConsoleCtrlDelegate ctrlHandler;

        private static Mutex singleInstanceMutex = null;
        private static HttpListener listener = null;
        private static IntPtr hContextGlobal = IntPtr.Zero;
        private static volatile bool isRunning = true;
        private static bool isCleaningUp = false;
        private static readonly object cleanupLock = new object();

        private static bool OnConsoleCtrl(uint dwCtrlType)
        {
            CleanExit();
            return true;
        }

        public static void CleanExit()
        {
            lock (cleanupLock)
            {
                if (isCleaningUp) return;
                isCleaningUp = true;
            }

            isRunning = false;

            try
            {
                if (listener != null)
                {
                    try { listener.Stop(); } catch { }
                    try { listener.Close(); } catch { }
                    listener = null;
                }
            }
            catch { }

            try
            {
                if (hContextGlobal != IntPtr.Zero)
                {
                    try { PcscInterop.SCardReleaseContext(hContextGlobal); } catch { }
                    hContextGlobal = IntPtr.Zero;
                }
            }
            catch { }

            try
            {
                if (singleInstanceMutex != null)
                {
                    try { singleInstanceMutex.ReleaseMutex(); } catch { }
                    try { singleInstanceMutex.Dispose(); } catch { }
                    singleInstanceMutex = null;
                }
            }
            catch { }

            try
            {
                Process.GetCurrentProcess().Kill();
            }
            catch
            {
                Environment.Exit(0);
            }
        }

        static void Main(string[] args)
        {
            ctrlHandler = new ConsoleCtrlDelegate(OnConsoleCtrl);
            SetConsoleCtrlHandler(ctrlHandler, true);

            AppDomain.CurrentDomain.ProcessExit += delegate { CleanExit(); };
            Console.CancelKeyPress += delegate(object s, ConsoleCancelEventArgs e)
            {
                e.Cancel = true;
                CleanExit();
            };

            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "โรงพยาบาลเถิน - Thoen Smart Card Bridge v2.0";

            if (args != null && args.Length > 0 && !string.IsNullOrEmpty(args[0]))
            {
                CloudBridgeClient.StationId = args[0].Trim();
            }

            try
            {
                bool isNewInstance = false;
                try
                {
                    singleInstanceMutex = new Mutex(true, "ThoenHospitalSmartCardBridgeMutex", out isNewInstance);
                }
                catch (AbandonedMutexException)
                {
                    isNewInstance = true;
                }

                if (!isNewInstance)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("===============================================================");
                    Console.WriteLine("    โรงพยาบาลเถิน - Thoen Smart Card Bridge v2.0               ");
                    Console.WriteLine("===============================================================");
                    Console.WriteLine(" [แจ้งเตือน]: โปรแกรมนี้กำลังเปิดทำงานอยู่แล้วที่คอมพิวเตอร์เครื่องนี้");
                    Console.WriteLine(" เสียบบัตรประชาชนแล้วข้อมูลจะส่งเข้าหน้าเว็บตรวจคัดกรองทันที");
                    Console.WriteLine("===============================================================");
                    Console.ResetColor();
                    Console.WriteLine("\nกรุณากดปุ่ม Enter หรือกดกากบาท [X] เพื่อปิดหน้าต่างนี้...");
                    Console.ReadLine();
                    CleanExit();
                    return;
                }

                Console.WriteLine("===============================================================");
                Console.WriteLine("    โรงพยาบาลเถิน - Thoen Smart Card Bridge v2.0               ");
                Console.WriteLine("===============================================================");
                Console.WriteLine(" [ระบบเชื่อมต่อ]: Smart Card Direct Browser Bridge (100% บน HTTPS)");
                Console.WriteLine(" [จุดบริการ]: จุดตรวจที่ " + CloudBridgeClient.StationId);
                Console.WriteLine(" [สถานะ]: กำลังค้นหาเครื่องอ่านบัตรประชาชน PC/SC...");

                int ret = PcscInterop.SCardEstablishContext(PcscInterop.SCARD_SCOPE_USER, IntPtr.Zero, IntPtr.Zero, out hContextGlobal);
                if (ret != 0)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine(" [ข้อผิดพลาด] ไม่สามารถเริ่มบริการ Smart Card Subsystem ได้ (Code: " + ret + ")");
                    Console.ResetColor();
                    Console.WriteLine("\nกรุณากดปุ่ม Enter หรือกดกากบาท [X] เพื่อปิดโปรแกรม...");
                    Console.ReadLine();
                    CleanExit();
                    return;
                }

                string readerName = CardReader.GetActiveReader(hContextGlobal);
                if (!string.IsNullOrEmpty(readerName))
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine(" [ตรวจพบเครื่องอ่าน]: " + readerName);
                    Console.ResetColor();
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine(" [รอการเชื่อมต่อ]: กรุณาเสียบเครื่องอ่านบัตร USB เข้ากับคอมพิวเตอร์");
                    Console.ResetColor();
                }

                // Send immediate status update to Web Cloud & Browser Page
                ThreadPool.QueueUserWorkItem(delegate
                {
                    try { CloudBridgeClient.SendPush("status", readerName, false, null); } catch { }
                    try
                    {
                        Thread.Sleep(600);
                        string readyJson = string.Format(
                            "{{\"source\":\"thoen_smartcard_bridge\",\"status\":\"ready\",\"reader\":\"{0}\",\"station\":\"{1}\"}}",
                            (readerName ?? "Smart Card Reader").Replace("\"", "\\\""),
                            CloudBridgeClient.StationId
                        );
                        BrowserInjector.InjectIntoBrowser(readyJson);
                    }
                    catch { }
                });

                // Start local HTTP server as parallel fallback on port 8084
                try
                {
                    listener = new HttpListener();
                    listener.Prefixes.Add("http://127.0.0.1:8084/");
                    try { listener.Prefixes.Add("http://localhost:8084/"); } catch { }
                    listener.Start();
                    Console.WriteLine(" [Local HTTP]: เปิดให้บริการสำรองที่ port 8084 (localhost)");
                }
                catch
                {
                    // If port 8084 is taken, direct browser bridge will still function 100%
                }

                // Start the automatic Card Monitor loop
                StartCardMonitorLoop();

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine(" [พร้อมใช้งาน]: เสียบบัตรประชาชนได้เลย ข้อมูลจะเด้งขึ้นหน้าเว็บทันที");
                Console.ResetColor();
                Console.WriteLine("===============================================================");
                Console.WriteLine(" * เสียบบัตรประชาชนเพื่ออ่านข้อมูล | กดกากบาท [X] หรือ Ctrl+C เพื่อปิด *");

                // Process requests on local listener (if active)
                while (isRunning && listener != null && listener.IsListening)
                {
                    try
                    {
                        HttpListenerContext context = listener.GetContext();
                        ThreadPool.QueueUserWorkItem(delegate
                        {
                            try { HandleLocalRequest(context, hContextGlobal); } catch { }
                        });
                    }
                    catch (HttpListenerException)
                    {
                        if (!isRunning) break;
                        Thread.Sleep(50);
                    }
                    catch
                    {
                        if (!isRunning) break;
                        Thread.Sleep(100);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(" [เกิดข้อผิดพลาดในการทำงาน]: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nกรุณากดปุ่ม Enter หรือกดกากบาท [X] เพื่อปิดโปรแกรม...");
                Console.ReadLine();
            }
            finally
            {
                CleanExit();
            }
        }

        static void StartCardMonitorLoop()
        {
            ThreadPool.QueueUserWorkItem(delegate
            {
                bool wasPresent = false;
                int idleTicks = 0;

                while (isRunning)
                {
                    try
                    {
                        string reader = CardReader.GetActiveReader(hContextGlobal);
                        bool isPresent = false;
                        if (!string.IsNullOrEmpty(reader))
                        {
                            isPresent = CardReader.CheckCardPresent(hContextGlobal, reader);
                        }

                        // State transition: Card Inserted
                        if (isPresent && !wasPresent)
                        {
                            wasPresent = true;
                            // Wait 350ms for electrical contacts to settle and ATR to stabilize
                            Thread.Sleep(350);
                            Console.ForegroundColor = ConsoleColor.Cyan;
                            Console.WriteLine(string.Format("\n [{0}] ตรวจพบบัตรประชาชนเสียบเข้าเครื่องอ่าน ({1})", DateTime.Now.ToString("HH:mm:ss"), reader));
                            Console.WriteLine(" [กำลังอ่านข้อมูลจากชิปการ์ด]...");
                            Console.ResetColor();

                            var cardData = CardReader.ReadCardData(hContextGlobal, reader);
                            if (cardData != null)
                            {
                                Console.ForegroundColor = ConsoleColor.Green;
                                Console.WriteLine("===============================================================");
                                Console.WriteLine(" [อ่านข้อมูลบัตรประชาชนสำเร็จ] " + DateTime.Now.ToString("dd/MM/yyyy HH:mm:ss"));
                                Console.WriteLine("---------------------------------------------------------------");
                                Console.WriteLine(" * เลขประจำตัวประชาชน : " + cardData["cid"]);
                                Console.WriteLine(" * ชื่อ - สกุล (ภาษาไทย) : " + cardData["fullNameTh"]);
                                if (!string.IsNullOrEmpty(cardData["fullNameEn"].ToString()))
                                    Console.WriteLine(" * Name (English)     : " + cardData["fullNameEn"]);
                                Console.WriteLine(" * วันเดือนปีเกิด       : " + cardData["birthDate"] + " (เพศ: " + cardData["gender"] + ")");
                                Console.WriteLine(" * ที่อยู่ตามทะเบียนบ้าน : " + cardData["address"]);
                                if (!string.IsNullOrEmpty(cardData["photo"].ToString()))
                                    Console.WriteLine(" * รูปถ่ายหน้าตรง      : อ่านสำเร็จ (พบข้อมูลภาพ JPEG ในชิป)");
                                Console.WriteLine("===============================================================");
                                Console.ResetColor();

                                // 1. Build JSON Payload for Direct Browser Injection
                                StringBuilder sb = new StringBuilder();
                                sb.Append("{\"source\":\"thoen_smartcard_bridge\",\"station\":\"").Append(CloudBridgeClient.StationId).Append("\",\"card\":{");
                                bool first = true;
                                foreach (var kv in cardData)
                                {
                                    if (!first) sb.Append(",");
                                    string val = kv.Value != null ? kv.Value.ToString() : "";
                                    sb.AppendFormat("\"{0}\":\"{1}\"", kv.Key, val.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n"));
                                    first = false;
                                }
                                sb.Append("}}");
                                string jsonStr = sb.ToString();

                                // 2. Copy to Windows Clipboard and Inject directly into Browser
                                BrowserInjector.InjectIntoBrowser(jsonStr);

                                try { Console.Beep(1200, 150); } catch { }

                                Console.ForegroundColor = ConsoleColor.Green;
                                Console.WriteLine(" >>> [อ่านข้อมูลบัตรประชาชนสำเร็จ]: ส่งข้อมูลเข้าหน้าจอและบันทึกในคลิปบอร์ดแล้ว <<<");
                                Console.WriteLine(" * ข้อมูลแสดงบนหน้าจอทันที ตรวจสอบความถูกต้องแล้วกด [Enter] เพื่อบันทึกเข้าคิว *\n");
                                Console.ResetColor();

                                // 3. Push to Web SSE Hub (Cloud fallback)
                                ThreadPool.QueueUserWorkItem(delegate
                                {
                                    try { CloudBridgeClient.SendPush("card_read", reader, true, cardData); } catch { }
                                });
                            }
                            else
                            {
                                Console.ForegroundColor = ConsoleColor.Yellow;
                                Console.WriteLine(" [แจ้งเตือน]: อ่านข้อมูลจากบัตรไม่สำเร็จ (กรุณาเสียบบัตรให้แน่นอีกครั้ง)\n");
                                Console.ResetColor();
                            }
                        }
                        // State transition: Card Removed
                        else if (!isPresent && wasPresent)
                        {
                            wasPresent = false;
                            Console.ForegroundColor = ConsoleColor.Cyan;
                            Console.WriteLine(string.Format(" [{0}] ดึงบัตรประชาชนออกจากเครื่องอ่านแล้ว (พร้อมรับบัตรใบถัดไป...)\n", DateTime.Now.ToString("HH:mm:ss")));
                            Console.ResetColor();

                            ThreadPool.QueueUserWorkItem(delegate
                            {
                                try { CloudBridgeClient.SendPush("card_removed", reader, false, null); } catch { }
                            });
                        }
                        else
                        {
                            // Periodic heartbeat every ~3 seconds (10 ticks * 300ms)
                            idleTicks++;
                            if (idleTicks >= 10)
                            {
                                idleTicks = 0;
                                string curReader = reader;
                                bool curPresent = isPresent;
                                ThreadPool.QueueUserWorkItem(delegate
                                {
                                    try { CloudBridgeClient.SendPush("status", curReader, curPresent, null); } catch { }
                                });
                            }
                        }
                    }
                    catch { }

                    Thread.Sleep(300);
                }
            });
        }

        static void HandleLocalRequest(HttpListenerContext context, IntPtr hContext)
        {
            if (context == null) return;
            HttpListenerRequest req = null;
            HttpListenerResponse res = null;

            try
            {
                req = context.Request;
                res = context.Response;

                string origin = req.Headers["Origin"];
                if (!string.IsNullOrEmpty(origin))
                {
                    res.Headers.Add("Access-Control-Allow-Origin", origin);
                    res.Headers.Add("Access-Control-Allow-Credentials", "true");
                }
                else
                {
                    res.Headers.Add("Access-Control-Allow-Origin", "*");
                }

                res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

                string reqHeaders = req.Headers["Access-Control-Request-Headers"];
                if (!string.IsNullOrEmpty(reqHeaders))
                {
                    res.Headers.Add("Access-Control-Allow-Headers", reqHeaders);
                }
                else
                {
                    res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network, Authorization, X-Requested-With, Cache-Control, Pragma");
                }

                res.Headers.Add("Access-Control-Allow-Private-Network", "true");
                res.Headers.Add("Access-Control-Max-Age", "86400");

                if (req.HttpMethod == "OPTIONS")
                {
                    res.StatusCode = 204;
                    res.Close();
                    return;
                }

                string path = req.Url.AbsolutePath.ToLower();
                string readerName = CardReader.GetActiveReader(hContext);
                bool isPresent = CardReader.CheckCardPresent(hContext, readerName);

                string json = "";

                if (path == "/status" || path == "/")
                {
                    json = string.Format("{{\"online\":true,\"reader\":\"{0}\",\"cardPresent\":{1}}}",
                        readerName != null ? readerName.Replace("\\", "\\\\").Replace("\"", "\\\"") : "None",
                        isPresent ? "true" : "false");
                }
                else if (path == "/read")
                {
                    if (!isPresent)
                    {
                        json = "{\"success\":false,\"error\":\"NO_CARD_PRESENT\",\"message\":\"ไม่พบบัตรประชาชนในเครื่องอ่าน\"}";
                    }
                    else
                    {
                        var data = CardReader.ReadCardData(hContext, readerName);
                        if (data != null)
                        {
                            StringBuilder sb = new StringBuilder();
                            sb.Append("{\"success\":true,\"data\":{");
                            bool first = true;
                            foreach (var kv in data)
                            {
                                if (!first) sb.Append(",");
                                sb.AppendFormat("\"{0}\":\"{1}\"", kv.Key, kv.Value.ToString().Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n"));
                                first = false;
                            }
                            sb.Append("}}");
                            json = sb.ToString();
                        }
                        else
                        {
                            json = "{\"success\":false,\"error\":\"READ_FAILED\",\"message\":\"อ่านข้อมูลจากบัตรไม่สำเร็จ\"}";
                        }
                    }
                }
                else
                {
                    res.StatusCode = 404;
                    res.Close();
                    return;
                }

                byte[] buffer = Encoding.UTF8.GetBytes(json);
                res.ContentType = "application/json; charset=utf-8";
                res.ContentLength64 = buffer.Length;
                res.OutputStream.Write(buffer, 0, buffer.Length);
                res.OutputStream.Close();
            }
            catch
            {
                try { res.Close(); } catch { }
            }
        }
    }
}

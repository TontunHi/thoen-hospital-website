using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
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
        private static byte[] APDU_SELECT_APPLET = new byte[] { 0x00, 0xA4, 0x04, 0x00, 0x08, 0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01 };
        private static byte[] APDU_READ_CID = new byte[] { 0x80, 0xB0, 0x00, 0x04, 0x02, 0x00, 0x0D };
        private static byte[] APDU_READ_NAME_TH = new byte[] { 0x80, 0xB0, 0x00, 0x11, 0x02, 0x00, 0x64 };
        private static byte[] APDU_READ_NAME_EN = new byte[] { 0x80, 0xB0, 0x00, 0x75, 0x02, 0x00, 0x64 };
        private static byte[] APDU_READ_DOB_GENDER = new byte[] { 0x80, 0xB0, 0x00, 0xE1, 0x02, 0x00, 0x12 };
        private static byte[] APDU_READ_ADDRESS = new byte[] { 0x80, 0xB0, 0x15, 0x79, 0x02, 0x00, 0x64 };

        public static string GetActiveReader(IntPtr hContext)
        {
            int chars = 2048;
            byte[] readers = new byte[chars];
            int ret = PcscInterop.SCardListReaders(hContext, null, readers, ref chars);
            if (ret != 0 || chars <= 1) return null;
            string raw = Encoding.ASCII.GetString(readers, 0, chars);
            string[] parts = raw.Split(new char[] { '\0' }, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length > 0 ? parts[0] : null;
        }

        public static bool CheckCardPresent(IntPtr hContext, string readerName)
        {
            if (string.IsNullOrEmpty(readerName)) return false;
            IntPtr hCard = IntPtr.Zero;
            uint proto = 0;
            int ret = PcscInterop.SCardConnect(hContext, readerName, PcscInterop.SCARD_SHARE_SHARED, PcscInterop.SCARD_PROTOCOL_T0 | PcscInterop.SCARD_PROTOCOL_T1, out hCard, out proto);
            if (ret == 0)
            {
                PcscInterop.SCardDisconnect(hCard, PcscInterop.SCARD_LEAVE_CARD);
                return true;
            }
            return false;
        }

        public static Dictionary<string, object> ReadCardData(IntPtr hContext, string readerName)
        {
            IntPtr hCard = IntPtr.Zero;
            uint proto = 0;
            int ret = PcscInterop.SCardConnect(hContext, readerName, PcscInterop.SCARD_SHARE_SHARED, PcscInterop.SCARD_PROTOCOL_T0 | PcscInterop.SCARD_PROTOCOL_T1, out hCard, out proto);
            if (ret != 0) return null;

            try
            {
                SCARD_IO_REQUEST pci = new SCARD_IO_REQUEST();
                pci.dwProtocol = proto;
                pci.cbPciLength = (uint)Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

                // Select Thai ID Applet
                byte[] recv = new byte[258];
                int recvLen = recv.Length;
                PcscInterop.SCardTransmit(hCard, ref pci, APDU_SELECT_APPLET, APDU_SELECT_APPLET.Length, IntPtr.Zero, recv, ref recvLen);

                Encoding thaiEncoding;
                try { thaiEncoding = Encoding.GetEncoding(874); }
                catch { thaiEncoding = Encoding.UTF8; }

                // 1. CID 13 Digits
                recvLen = recv.Length;
                PcscInterop.SCardTransmit(hCard, ref pci, APDU_READ_CID, APDU_READ_CID.Length, IntPtr.Zero, recv, ref recvLen);
                string cid = Encoding.ASCII.GetString(recv, 0, Math.Min(13, recvLen)).Trim();

                // 2. Name TH
                recvLen = recv.Length;
                PcscInterop.SCardTransmit(hCard, ref pci, APDU_READ_NAME_TH, APDU_READ_NAME_TH.Length, IntPtr.Zero, recv, ref recvLen);
                string rawNameTh = thaiEncoding.GetString(recv, 0, Math.Max(0, recvLen - 2)).Trim('\0');
                string[] nameThParts = rawNameTh.Split(new char[] { '#' });
                string titleTh = nameThParts.Length > 0 ? nameThParts[0].Trim() : "";
                string firstTh = nameThParts.Length > 1 ? nameThParts[1].Trim() : "";
                string midTh = nameThParts.Length > 2 ? nameThParts[2].Trim() : "";
                string lastTh = nameThParts.Length > 3 ? nameThParts[3].Trim() : "";
                string fullTh = string.Join(" ", new string[] { titleTh, firstTh, midTh, lastTh }).Replace("  ", " ").Trim();

                // 3. Name EN
                recvLen = recv.Length;
                PcscInterop.SCardTransmit(hCard, ref pci, APDU_READ_NAME_EN, APDU_READ_NAME_EN.Length, IntPtr.Zero, recv, ref recvLen);
                string rawNameEn = Encoding.ASCII.GetString(recv, 0, Math.Max(0, recvLen - 2)).Trim('\0');
                string[] nameEnParts = rawNameEn.Split(new char[] { '#' });
                string titleEn = nameEnParts.Length > 0 ? nameEnParts[0].Trim() : "";
                string firstEn = nameEnParts.Length > 1 ? nameEnParts[1].Trim() : "";
                string midEn = nameEnParts.Length > 2 ? nameEnParts[2].Trim() : "";
                string lastEn = nameEnParts.Length > 3 ? nameEnParts[3].Trim() : "";
                string fullEn = string.Join(" ", new string[] { titleEn, firstEn, midEn, lastEn }).Replace("  ", " ").Trim();

                // 4. DOB / Gender
                recvLen = recv.Length;
                PcscInterop.SCardTransmit(hCard, ref pci, APDU_READ_DOB_GENDER, APDU_READ_DOB_GENDER.Length, IntPtr.Zero, recv, ref recvLen);
                string dobRaw = Encoding.ASCII.GetString(recv, 0, Math.Min(8, recvLen)).Trim();
                string birthDate = dobRaw.Length >= 8 ? string.Format("{0}-{1}-{2}", dobRaw.Substring(0, 4), dobRaw.Substring(4, 2), dobRaw.Substring(6, 2)) : dobRaw;
                string genderCode = recvLen >= 9 ? Encoding.ASCII.GetString(recv, 8, 1) : "";
                string gender = genderCode == "1" ? "ชาย" : (genderCode == "2" ? "หญิง" : "ไม่ระบุ");

                // 5. Address
                recvLen = recv.Length;
                PcscInterop.SCardTransmit(hCard, ref pci, APDU_READ_ADDRESS, APDU_READ_ADDRESS.Length, IntPtr.Zero, recv, ref recvLen);
                string rawAddress = thaiEncoding.GetString(recv, 0, Math.Max(0, recvLen - 2)).Trim('\0');
                string[] addrParts = rawAddress.Split(new char[] { '#' }, StringSplitOptions.RemoveEmptyEntries);
                string address = string.Join(" ", addrParts).Trim();

                Dictionary<string, object> data = new Dictionary<string, object>();
                data["cid"] = cid;
                data["titleTh"] = titleTh;
                data["firstNameTh"] = firstTh;
                data["lastNameTh"] = lastTh;
                data["fullNameTh"] = fullTh;
                data["titleEn"] = titleEn;
                data["firstNameEn"] = firstEn;
                data["lastNameEn"] = lastEn;
                data["fullNameEn"] = fullEn;
                data["birthDate"] = birthDate;
                data["gender"] = gender;
                data["address"] = address;
                data["readTimestamp"] = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:sszzz");
                data["readerName"] = readerName;
                data["source"] = "SMART_CARD_BRIDGE_PCSC";

                return data;
            }
            finally
            {
                PcscInterop.SCardDisconnect(hCard, PcscInterop.SCARD_LEAVE_CARD);
            }
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "โรงพยาบาลเถิน - Smart Card Bridge v1.0";

            Console.WriteLine("===============================================================");
            Console.WriteLine("    โรงพยาบาลเถิน - Thoen Smart Card Bridge Service v1.0       ");
            Console.WriteLine("===============================================================");
            Console.WriteLine(" สถานะ: กำลังค้นหาเครื่องอ่านบัตรประชาชน PC/SC...");

            IntPtr hContext = IntPtr.Zero;
            int ret = PcscInterop.SCardEstablishContext(PcscInterop.SCARD_SCOPE_USER, IntPtr.Zero, IntPtr.Zero, out hContext);
            if (ret != 0)
            {
                Console.WriteLine(" [ข้อผิดพลาด] ไม่สามารถเริ่มบริการ Smart Card Subsystem ได้ (Code: " + ret + ")");
                Console.WriteLine(" กรุณากดปุ่มใดๆ เพื่อปิดโปรแกรม");
                Console.ReadKey();
                return;
            }

            string readerName = CardReader.GetActiveReader(hContext);
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

            HttpListener listener = new HttpListener();
            string prefix = "http://127.0.0.1:8084/";
            try
            {
                listener.Prefixes.Add(prefix);
                listener.Start();
                Console.WriteLine(" [HTTP Server]: เปิดให้บริการที่ " + prefix);
                Console.WriteLine(" [พร้อมใช้งาน]: หน้าเว็บระบบคัดกรองตรวจนอกพื้นที่จะเชื่อมต่ออัตโนมัติ");
                Console.WriteLine("===============================================================");
                Console.WriteLine(" * เสียบบัตรประชาชนเพื่ออ่านข้อมูล | กด Ctrl+C เพื่อปิดการทำงาน *");
            }
            catch (Exception ex)
            {
                Console.WriteLine(" [ข้อผิดพลาด]: ไม่สามารถเปิด Port 8084 ได้: " + ex.Message);
                return;
            }

            while (true)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((state) => HandleRequest(context, hContext));
                }
                catch
                {
                    break;
                }
            }
        }

        static void HandleRequest(HttpListenerContext context, IntPtr hContext)
        {
            HttpListenerRequest req = context.Request;
            HttpListenerResponse res = context.Response;

            // CORS headers for web browser communication
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

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
                    try
                    {
                        var data = CardReader.ReadCardData(hContext, readerName);
                        if (data != null)
                        {
                            Console.ForegroundColor = ConsoleColor.Cyan;
                            Console.WriteLine("[อ่านสำเร็จ]: " + data["fullNameTh"] + " (" + data["cid"] + ") เวลา " + DateTime.Now.ToString("HH:mm:ss"));
                            Console.ResetColor();

                            StringBuilder sb = new StringBuilder();
                            sb.Append("{\"success\":true,\"data\":{");
                            bool first = true;
                            foreach (var kv in data)
                            {
                                if (!first) sb.Append(",");
                                sb.AppendFormat("\"{0}\":\"{1}\"", kv.Key, kv.Value.ToString().Replace("\\", "\\\\").Replace("\"", "\\\""));
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
                    catch (Exception ex)
                    {
                        json = string.Format("{{\"success\":false,\"error\":\"EXCEPTION\",\"message\":\"{0}\"}}", ex.Message.Replace("\"", "\\\""));
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
    }
}

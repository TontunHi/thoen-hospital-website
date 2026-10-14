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
            byte[] recv = new byte[300];
            int recvLen = recv.Length;
            int ret = PcscInterop.SCardTransmit(hCard, ref pci, apdu, apdu.Length, IntPtr.Zero, recv, ref recvLen);
            if (ret != 0) return new byte[0];

            // If SW1 == 0x61, card says: XX bytes available, send GET RESPONSE (00 C0 00 00 Le)
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
            else if (recvLen >= 2 && recv[recvLen - 2] == 0x90 && recv[recvLen - 1] == 0x00)
            {
                byte[] data = new byte[recvLen - 2];
                Array.Copy(recv, 0, data, 0, recvLen - 2);
                return data;
            }

            return new byte[0];
        }

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

                // 1. Select Thai ID MOI Applet
                SendApdu(hCard, ref pci, APDU_SELECT_APPLET);

                Encoding thaiEncoding;
                try { thaiEncoding = Encoding.GetEncoding(874); }
                catch { thaiEncoding = Encoding.UTF8; }

                // 2. CID (13 Digits)
                byte[] cidBytes = SendApdu(hCard, ref pci, APDU_READ_CID);
                string cid = Encoding.ASCII.GetString(cidBytes).Trim();
                if (string.IsNullOrEmpty(cid) || cid.Length < 13)
                {
                    return null;
                }

                // 3. Name Thai
                byte[] nameThBytes = SendApdu(hCard, ref pci, APDU_READ_NAME_TH);
                string rawNameTh = thaiEncoding.GetString(nameThBytes).Trim();
                string[] nameThParts = rawNameTh.Split(new char[] { '#' });
                string titleTh = nameThParts.Length > 0 ? nameThParts[0].Trim() : "";
                string firstTh = nameThParts.Length > 1 ? nameThParts[1].Trim() : "";
                string midTh = nameThParts.Length > 2 ? nameThParts[2].Trim() : "";
                string lastTh = nameThParts.Length > 3 ? nameThParts[3].Trim() : "";
                string fullTh = string.Join(" ", new string[] { titleTh, firstTh, midTh, lastTh }).Replace("  ", " ").Trim();

                // 4. Name English
                byte[] nameEnBytes = SendApdu(hCard, ref pci, APDU_READ_NAME_EN);
                string rawNameEn = Encoding.ASCII.GetString(nameEnBytes).Trim();
                string[] nameEnParts = rawNameEn.Split(new char[] { '#' });
                string titleEn = nameEnParts.Length > 0 ? nameEnParts[0].Trim() : "";
                string firstEn = nameEnParts.Length > 1 ? nameEnParts[1].Trim() : "";
                string midEn = nameEnParts.Length > 2 ? nameEnParts[2].Trim() : "";
                string lastEn = nameEnParts.Length > 3 ? nameEnParts[3].Trim() : "";
                string fullEn = string.Join(" ", new string[] { titleEn, firstEn, midEn, lastEn }).Replace("  ", " ").Trim();

                // 5. Date of Birth (YYYYMMDD)
                byte[] dobBytes = SendApdu(hCard, ref pci, APDU_READ_DOB);
                string dobRaw = Encoding.ASCII.GetString(dobBytes).Trim();
                string birthDate = dobRaw.Length >= 8 
                    ? string.Format("{0}-{1}-{2}", dobRaw.Substring(0, 4), dobRaw.Substring(4, 2), dobRaw.Substring(6, 2)) 
                    : dobRaw;

                // 6. Gender (1 = ชาย, 2 = หญิง)
                byte[] genderBytes = SendApdu(hCard, ref pci, APDU_READ_GENDER);
                string genderCode = Encoding.ASCII.GetString(genderBytes).Trim();
                string gender = genderCode == "1" ? "ชาย" : (genderCode == "2" ? "หญิง" : "ไม่ระบุ");

                // 7. Address
                byte[] addrBytes = SendApdu(hCard, ref pci, APDU_READ_ADDRESS);
                string rawAddress = thaiEncoding.GetString(addrBytes).Trim();
                string[] addrParts = rawAddress.Split(new char[] { '#' }, StringSplitOptions.RemoveEmptyEntries);
                string address = string.Join(" ", addrParts).Trim();

                // 8. Issuer, Issue Date & Expire Date
                byte[] issuerBytes = SendApdu(hCard, ref pci, APDU_READ_ISSUER);
                string issuer = thaiEncoding.GetString(issuerBytes).Trim();

                byte[] issueDateBytes = SendApdu(hCard, ref pci, APDU_READ_ISSUE_DATE);
                string rawIssueDate = Encoding.ASCII.GetString(issueDateBytes).Trim();
                string issueDate = rawIssueDate.Length >= 8 
                    ? string.Format("{0}-{1}-{2}", rawIssueDate.Substring(0, 4), rawIssueDate.Substring(4, 2), rawIssueDate.Substring(6, 2)) 
                    : rawIssueDate;

                byte[] expDateBytes = SendApdu(hCard, ref pci, APDU_READ_EXP_DATE);
                string rawExpDate = Encoding.ASCII.GetString(expDateBytes).Trim();
                string expireDate = rawExpDate.Length >= 8 
                    ? string.Format("{0}-{1}-{2}", rawExpDate.Substring(0, 4), rawExpDate.Substring(4, 2), rawExpDate.Substring(6, 2)) 
                    : rawExpDate;

                // 9. Photo (JPEG)
                string photoBase64 = "";
                try
                {
                    using (MemoryStream ms = new MemoryStream())
                    {
                        foreach (byte[] apdu in PHOTO_APDUS)
                        {
                            byte[] chunk = SendApdu(hCard, ref pci, apdu);
                            if (chunk.Length == 0) break;
                            ms.Write(chunk, 0, chunk.Length);
                        }
                        byte[] allPhotoBytes = ms.ToArray();
                        if (allPhotoBytes.Length > 200 && allPhotoBytes[0] == 0xFF && allPhotoBytes[1] == 0xD8)
                        {
                            photoBase64 = "data:image/jpeg;base64," + Convert.ToBase64String(allPhotoBytes);
                        }
                    }
                }
                catch { }

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
                data["issuer"] = issuer;
                data["issueDate"] = issueDate;
                data["expireDate"] = expireDate;
                data["photo"] = photoBase64;
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
        private static Mutex singleInstanceMutex = null;

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "โรงพยาบาลเถิน - Smart Card Bridge v1.2";

            try
            {
                bool isNewInstance = false;
                singleInstanceMutex = new Mutex(true, "ThoenHospitalSmartCardBridgeMutex", out isNewInstance);
                if (!isNewInstance)
                {
                    Console.ForegroundColor = ConsoleColor.Yellow;
                    Console.WriteLine("===============================================================");
                    Console.WriteLine("    โรงพยาบาลเถิน - Thoen Smart Card Bridge                    ");
                    Console.WriteLine("===============================================================");
                    Console.WriteLine(" [แจ้งเตือน]: โปรแกรมนี้กำลังเปิดทำงานอยู่แล้วที่คอมพิวเตอร์เครื่องนี้");
                    Console.WriteLine(" หน้าเว็บ http://localhost:3000/service/screening/scan");
                    Console.WriteLine(" สามารถเชื่อมต่อและใช้งานเครื่องอ่านบัตรประชาชนได้ทันทีโดยไม่ต้องเปิดซ้ำ");
                    Console.WriteLine("===============================================================");
                    Console.ResetColor();
                    Console.WriteLine("\nกรุณากดปุ่ม Enter หรือปิดหน้าต่างนี้ได้เลยครับ...");
                    Console.ReadLine();
                    return;
                }

                Console.WriteLine("===============================================================");
                Console.WriteLine("    โรงพยาบาลเถิน - Thoen Smart Card Bridge Service v1.2       ");
                Console.WriteLine("===============================================================");
                Console.WriteLine(" สถานะ: กำลังค้นหาเครื่องอ่านบัตรประชาชน PC/SC...");

                IntPtr hContext = IntPtr.Zero;
                int ret = PcscInterop.SCardEstablishContext(PcscInterop.SCARD_SCOPE_USER, IntPtr.Zero, IntPtr.Zero, out hContext);
                if (ret != 0)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine(" [ข้อผิดพลาด] ไม่สามารถเริ่มบริการ Smart Card Subsystem ได้ (Code: " + ret + ")");
                    Console.ResetColor();
                    Console.WriteLine("\nกรุณากดปุ่ม Enter เพื่อปิดโปรแกรม...");
                    Console.ReadLine();
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
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine(" [ข้อผิดพลาด]: ไม่สามารถเปิด Port 8084 ได้: " + ex.Message);
                    Console.ResetColor();
                    Console.WriteLine("\nกรุณากดปุ่ม Enter เพื่อปิดโปรแกรม...");
                    Console.ReadLine();
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
                        Thread.Sleep(500);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(" [เกิดข้อผิดพลาดในการทำงาน]: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("\nกรุณากดปุ่ม Enter เพื่อปิดโปรแกรม...");
                Console.ReadLine();
            }
            finally
            {
                if (singleInstanceMutex != null)
                {
                    try { singleInstanceMutex.ReleaseMutex(); }
                    catch { }
                }
            }
        }

        static void HandleRequest(HttpListenerContext context, IntPtr hContext)
        {
            HttpListenerRequest req = context.Request;
            HttpListenerResponse res = context.Response;

            // CORS & Chrome Private Network Access (PNA) headers
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network");
            res.Headers.Add("Access-Control-Allow-Private-Network", "true");

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
                                sb.AppendFormat("\"{0}\":\"{1}\"", kv.Key, kv.Value.ToString().Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "\\n"));
                                first = false;
                            }
                            sb.Append("}}");
                            json = sb.ToString();
                        }
                        else
                        {
                            json = "{\"success\":false,\"error\":\"READ_FAILED\",\"message\":\"อ่านข้อมูลจากบัตรไม่สำเร็จ (กรุณาเสียบบัตรให้แน่นอีกครั้ง)\"}";
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

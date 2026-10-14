using System;
using System.Runtime.InteropServices;
using System.Text;

class CardTester
{
    [StructLayout(LayoutKind.Sequential)]
    public struct SCARD_IO_REQUEST
    {
        public uint dwProtocol;
        public uint cbPciLength;
    }

    [DllImport("winscard.dll")]
    public static extern int SCardEstablishContext(uint dwScope, IntPtr pvReserved1, IntPtr pvReserved2, out IntPtr phContext);

    [DllImport("winscard.dll", EntryPoint = "SCardListReadersA", CharSet = CharSet.Ansi)]
    public static extern int SCardListReaders(IntPtr hContext, string mszGroups, byte[] mszReaders, ref int pcchReaders);

    [DllImport("winscard.dll", EntryPoint = "SCardConnectA", CharSet = CharSet.Ansi)]
    public static extern int SCardConnect(IntPtr hContext, string szReader, uint dwShareMode, uint dwPreferredProtocols, out IntPtr phCard, out uint pdwActiveProtocol);

    [DllImport("winscard.dll")]
    public static extern int SCardDisconnect(IntPtr hCard, uint dwDisposition);

    [DllImport("winscard.dll")]
    public static extern int SCardTransmit(IntPtr hCard, ref SCARD_IO_REQUEST pioSendPci, byte[] pbSendBuffer, int cbSendLength, IntPtr pioRecvPci, byte[] pbRecvBuffer, ref int pcbRecvLength);

    static byte[] SendApdu(IntPtr hCard, ref SCARD_IO_REQUEST pci, byte[] apdu)
    {
        byte[] recv = new byte[300];
        int recvLen = recv.Length;
        int ret = SCardTransmit(hCard, ref pci, apdu, apdu.Length, IntPtr.Zero, recv, ref recvLen);
        if (ret != 0)
        {
            Console.WriteLine("Transmit failed: " + ret.ToString("X"));
            return new byte[0];
        }

        Console.Write("SEND: " + BitConverter.ToString(apdu) + " => RECV (" + recvLen + " bytes): ");
        for (int i = 0; i < recvLen; i++) Console.Write(recv[i].ToString("X2") + " ");
        Console.WriteLine();

        // Check SW1 == 0x61 (more data / GET RESPONSE needed)
        if (recvLen == 2 && recv[0] == 0x61)
        {
            byte le = recv[1];
            byte[] getResponse = new byte[] { 0x00, 0xC0, 0x00, 0x00, le };
            recvLen = recv.Length;
            ret = SCardTransmit(hCard, ref pci, getResponse, getResponse.Length, IntPtr.Zero, recv, ref recvLen);
            Console.Write("  -> GET RESPONSE (Le=" + le.ToString("X2") + ") => (" + recvLen + " bytes): ");
            for (int i = 0; i < recvLen; i++) Console.Write(recv[i].ToString("X2") + " ");
            Console.WriteLine();

            if (recvLen >= 2 && recv[recvLen - 2] == 0x90 && recv[recvLen - 1] == 0x00)
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

        return recv;
    }

    static void Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        IntPtr hContext;
        int ret = SCardEstablishContext(0, IntPtr.Zero, IntPtr.Zero, out hContext);
        int chars = 2048;
        byte[] readers = new byte[chars];
        SCardListReaders(hContext, null, readers, ref chars);
        string readerName = Encoding.ASCII.GetString(readers).Split('\0')[0];
        Console.WriteLine("Reader: " + readerName);

        IntPtr hCard;
        uint proto;
        ret = SCardConnect(hContext, readerName, 2, 3, out hCard, out proto);
        if (ret != 0)
        {
            Console.WriteLine("Connect error: " + ret.ToString("X"));
            return;
        }

        SCARD_IO_REQUEST pci = new SCARD_IO_REQUEST();
        pci.dwProtocol = proto;
        pci.cbPciLength = (uint)Marshal.SizeOf(typeof(SCARD_IO_REQUEST));

        Console.WriteLine("--- SELECT MOI APPLET ---");
        byte[] selectApplet = new byte[] { 0x00, 0xA4, 0x04, 0x00, 0x08, 0xA0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01 };
        SendApdu(hCard, ref pci, selectApplet);

        Console.WriteLine("--- READ CID ---");
        byte[] readCid = new byte[] { 0x80, 0xB0, 0x00, 0x04, 0x02, 0x00, 0x0D };
        byte[] cidBytes = SendApdu(hCard, ref pci, readCid);
        Console.WriteLine("CID: " + Encoding.ASCII.GetString(cidBytes));

        Console.WriteLine("--- READ NAME TH ---");
        byte[] readNameTh = new byte[] { 0x80, 0xB0, 0x00, 0x11, 0x02, 0x00, 0x64 };
        byte[] nameThBytes = SendApdu(hCard, ref pci, readNameTh);
        Encoding thaiEnc = Encoding.GetEncoding(874);
        Console.WriteLine("Name TH (TIS-620): " + thaiEnc.GetString(nameThBytes));

        Console.WriteLine("--- READ NAME EN ---");
        byte[] readNameEn = new byte[] { 0x80, 0xB0, 0x00, 0x75, 0x02, 0x00, 0x64 };
        byte[] nameEnBytes = SendApdu(hCard, ref pci, readNameEn);
        Console.WriteLine("Name EN: " + Encoding.ASCII.GetString(nameEnBytes));

        Console.WriteLine("--- READ DOB (offset 00 D9, len 8) ---");
        byte[] readDob = new byte[] { 0x80, 0xB0, 0x00, 0xD9, 0x02, 0x00, 0x08 };
        byte[] dobBytes = SendApdu(hCard, ref pci, readDob);
        Console.WriteLine("DOB: " + Encoding.ASCII.GetString(dobBytes));

        Console.WriteLine("--- READ GENDER (offset 00 E1, len 1) ---");
        byte[] readGender = new byte[] { 0x80, 0xB0, 0x00, 0xE1, 0x02, 0x00, 0x01 };
        byte[] genderBytes = SendApdu(hCard, ref pci, readGender);
        Console.WriteLine("Gender: " + Encoding.ASCII.GetString(genderBytes));

        Console.WriteLine("--- READ CARD ISSUER (offset 00 F6, len 64) ---");
        byte[] readIssuer = new byte[] { 0x80, 0xB0, 0x00, 0xF6, 0x02, 0x00, 0x64 };
        byte[] issuerBytes = SendApdu(hCard, ref pci, readIssuer);
        Console.WriteLine("Issuer: " + thaiEnc.GetString(issuerBytes));

        Console.WriteLine("--- READ ISSUE DATE (offset 01 67, len 8) ---");
        byte[] readIssueDate = new byte[] { 0x80, 0xB0, 0x01, 0x67, 0x02, 0x00, 0x08 };
        byte[] issueDateBytes = SendApdu(hCard, ref pci, readIssueDate);
        Console.WriteLine("Issue Date: " + Encoding.ASCII.GetString(issueDateBytes));

        Console.WriteLine("--- READ EXPIRE DATE (offset 01 6F, len 8) ---");
        byte[] readExpDate = new byte[] { 0x80, 0xB0, 0x01, 0x6F, 0x02, 0x00, 0x08 };
        byte[] expDateBytes = SendApdu(hCard, ref pci, readExpDate);
        Console.WriteLine("Expire Date: " + Encoding.ASCII.GetString(expDateBytes));

        Console.WriteLine("--- READ FULL PHOTO ---");
        byte[][] photoApdus = new byte[][] {
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
        using (var ms = new System.IO.MemoryStream())
        {
            foreach (var apdu in photoApdus)
            {
                byte[] chunk = SendApdu(hCard, ref pci, apdu);
                if (chunk.Length == 0) break;
                ms.Write(chunk, 0, chunk.Length);
            }
            byte[] photoBytes = ms.ToArray();
            Console.WriteLine("Total Photo Bytes: " + photoBytes.Length + " bytes");
            string base64 = Convert.ToBase64String(photoBytes);
            Console.WriteLine("Base64 start: " + base64.Substring(0, Math.Min(40, base64.Length)));
        }

        SCardDisconnect(hCard, 0);
    }
}

# Generate-QRs.ps1
param(
    [string]$OutDir = "$PWD\PathologistQRCodes",

    # Use a hashtable: Key = file-safe short code, Value = display name
    [hashtable]$Doctors = @{
        MXA = 'Masoud Asgari'
        AXA = 'Alfredo Asuncion'
        NXB = 'Nasim Babaidorabad'
        SMB = 'Sepideh Banankah'
        RHB = 'Ricardo Bardales'
        PXB = 'Preeti Behl'
        TSB = 'Takinder Bisla'
        OLB = 'Olga Bohn'
        HCC = 'Harvey Chang'
        PJC = 'Prakash Chaudhari'
        MJC = 'Michael Costa'
        SCE = 'Shawn Emery'
        SPF = 'Steven Fogel'
        DRH = 'Donovan Hare'
        NXH = 'Nazila Hejazi'
        SXH = 'Seyed Amin Hojat'
        YXH = 'Yingchuan Hu'
        EXK = 'Emad Kaabipour'
        SJK = 'Sara Kwong'
        TIL = 'Teresa Limjoco'
        LUU = 'Martin Luu'
        GXP = 'Gopal Patel'
        CPV = 'Christy Perez-Valles'
        MMR = 'Melissa Rodgers'
        DLS = 'Diane Sanders'
        RXS = 'Roya Setarehshenas'
        SGS = 'Scott Silveira'
        PSE = 'Phillip Starshak'
        CRS = 'Curtis Strong'
        RNT = 'Rana Tawil'
        MXT = 'Miao Tan'
        LXV = 'Linda Veneman'
        ARV = 'Anthony Victorio'
        AMW = 'Anthony Wheeler'
        TLY = 'Tony Yang'
        KXZ = 'Kuixing Zhang'
        YXZ = 'Yi Zhuang'
    }
)

# ---------- fetch QRCoder once ----------
$lib = "$PSScriptRoot\QRCoder.dll"
if (-not (Test-Path $lib)) {
    $tmp = "$env:TEMP\qrcoder_$([guid]::NewGuid())"
    Invoke-WebRequest "https://www.nuget.org/api/v2/package/QRCoder/1.6.0" -OutFile "$tmp.zip"
    Expand-Archive "$tmp.zip" -DestinationPath $tmp -Force
    $dll = Get-ChildItem $tmp -Recurse -Filter QRCoder.dll | Select-Object -First 1
    Copy-Item $dll.FullName $lib
    Remove-Item $tmp, "$tmp.zip" -Recurse -Force
}
Add-Type -Path $lib

# ---------- output dir ----------
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$gen = [QRCoder.QRCodeGenerator]::new()
foreach ($code in $Doctors.Keys) {

    # 1. payload string that matches verifier regex
    $payload = "PA:$code"

    # 2. QR bitmap
    $data = $gen.CreateQrCode($payload, [QRCoder.QRCodeGenerator+ECCLevel]::Q)
    $qr   = [QRCoder.QRCode]::new($data)
    $bmp  = $qr.GetGraphic(20)

    # 3. file name uses short code only – safe
    $file = Join-Path $OutDir "$code.png"
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)

    # 4. console output with full name for sanity
    Write-Host ("Wrote {0}  ->  {1}" -f $code, $Doctors[$code])
}

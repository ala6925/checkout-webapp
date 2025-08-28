# Generate-QRs.ps1
param(
    [string]$OutDir = "$PWD\PathologistQRCodes",
    [string[]]$Doctors = @(
        'Masoud Asgari (MXA)','Alfredo Asuncion (AXA)','Nasim Babaidorabad (NXB)','Sepideh Banankah (SMB)','Ricardo Bardales (RHB)','Preeti Behl (PXB)','Takinder Bisla (TSB)','Olga Bohn (OLB)','Harvey Chang (HCC)','Prakash Chaudhari (PJC)','Michael Costa (MJC)', 'Shawn Emery (SCE)','Steven Fogel (SPF)','Donovan Hare (DRH)','Nazila Hejazi (NXH)','Seyed Amin Hojat (SXH)','Yingchuan Hu (YXH)','Emad Kaabipour (EXK)','Sara Kwong (SJK)','Teresa Limjoco (TIL)','Martin Luu (LUU)','Gopal Patel (GXP)','Christy Perez-Valles (CPV)','Melissa Rodgers (MMR)','Diane Sanders (DLS)','Roya Setarehshenas (RXS)','Scott Silveira (SGS)','Phillip Starshak (PSE),'Curtis Strong (CRS)','Rana Tawil (RNT)','Miao Tan (MXT)','Linda Veneman (LXV)','Anthony Victorio (ARV)','Anthony Wheeler (AMW)')
)

# Pull QRCoder DLL
if (-not (Test-Path ".\QRCoder.dll")) {
    Invoke-WebRequest -Uri "https://www.nuget.org/api/v2/package/QRCoder/1.6.0" -OutFile q.tzip
    Expand-Archive q.tzip -DestinationPath .\qtmp -Force
    Copy-Item .\qtmp\**\QRCoder.dll -Destination .\QRCoder.dll
    Remove-Item q.tzip, qtmp -Recurse
}

Add-Type -Path ".\QRCoder.dll"

[System.IO.Directory]::CreateDirectory($OutDir) | Out-Null
$gen  = [QRCoder.QRCodeGenerator]::new()
foreach ($d in $Doctors) {
    $payload = "PA:$d"
    $data = $gen.CreateQrCode($payload, [QRCoder.QRCodeGenerator+ECCLevel]::Q)
    $qr = [QRCoder.QRCode]::new($data)
    $bmp = $qr.GetGraphic(20)  # 20 = pixels per module
    $file = Join-Path $OutDir "$d.png"
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Wrote $file"
}

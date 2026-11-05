"""Credential-free synthetic source creation; no real clinical results."""
def pdf(lines):
 content='BT /F1 14 Tf 30 750 Td '+' Tj 0 -24 Td '.join('('+line.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')+')' for line in lines)+' Tj ET'
 objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+str(len(content))+' >>\nstream\n'+content+'\nendstream']
 data=b'%PDF-1.4\n';offsets=[]
 for i,obj in enumerate(objects):offsets.append(len(data));data+=(str(i+1)+' 0 obj\n'+obj+'\nendobj\n').encode('ascii')
 xref=len(data);data+=b'xref\n0 6\n0000000000 65535 f \n'+''.join(f'{offset:010d} 00000 n \n' for offset in offsets).encode();data+=('trailer << /Size 6 /Root 1 0 R >>\nstartxref\n'+str(xref)+'\n%%EOF').encode();return data

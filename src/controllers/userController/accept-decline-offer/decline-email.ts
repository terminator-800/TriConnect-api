export interface ApplicationDeclinedTemplateProps {
  name: string;
  position: string;
  company: string;
  date: string;
  jobDetailsUrl: string;
}

export const applicationDeclinedTemplate = ({
  name,
  position,
  company,
  date,
  jobDetailsUrl
}: ApplicationDeclinedTemplateProps): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Application Update</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; overflow:hidden;">
          
          <tr>
            <td style="background:#dc3545; padding:30px 20px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:bold;">
                Application Update
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:30px; color:#333333; font-size:16px; line-height:1.6;">
              <p>Hi <strong>${name}</strong>,</p>
              
              <p>
                We regret to inform you that I must decline your job offer for the 
                <strong>${position}</strong> position at 
                <strong>${company}</strong>.
                </p>


              <div style="border-left:4px solid #dc3545; padding-left:15px; margin:25px 0;">
                <p style="margin:0; font-weight:bold;">Details:</p>
                <p style="margin:4px 0;">Position: <strong>${position}</strong></p>
                <p style="margin:4px 0;">Company: <strong>${company}</strong></p>
                <p style="margin:4px 0;">Date: <strong>${date}</strong></p>
              </div>

              <p>
                We appreciate your job offer; however, I have decided to decline this opportunity.
              </p>


              <div style="text-align:center; margin-top:35px;">
                <a 
                  href="${jobDetailsUrl}" 
                  style="
                    background:#dc3545;
                    color:#ffffff;
                    padding:15px 35px;
                    font-size:18px;
                    text-decoration:none;
                    border-radius:8px;
                    display:inline-block;
                  "
                >
                  View Messages
                </a>
              </div>

              <br /><br />
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

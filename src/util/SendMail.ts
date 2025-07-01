import { getMailOptions, transport } from "./nodemailer"

type mailparams = {
    userEmail: string;
    userName: string;
    token: string;
}
export const sendConfirmationMail = async ({userEmail, userName, token}:mailparams) => {
    const mailoptions = getMailOptions(userEmail, userName, token)
    transport.sendMail(mailoptions)
}
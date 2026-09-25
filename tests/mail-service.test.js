const nodemailer=require("nodemailer");
const mail=require("../services/mail");
describe("mail service",()=>{const original={...process.env};afterEach(()=>{process.env={...original};mail.resetTransport();jest.restoreAllMocks();});
  test("does not claim delivery without SMTP configuration",async()=>{delete process.env.EMAIL_HOST;await expect(mail.sendPasswordResetEmail("user@example.com","secret-token")).resolves.toEqual({ok:false,reason:"not_configured"});});
  test("sends reset token only inside the reset link",async()=>{Object.assign(process.env,{EMAIL_HOST:"smtp.example.com",EMAIL_PORT:"587",EMAIL_USER:"u",EMAIL_PASS:"p",EMAIL_FROM:"no-reply@example.com",APP_BASE_URL:"https://app.example.com"});const sendMail=jest.fn().mockResolvedValue({messageId:"m1"});jest.spyOn(nodemailer,"createTransport").mockReturnValue({sendMail});await expect(mail.sendPasswordResetEmail("user@example.com","a b&c")).resolves.toMatchObject({ok:true,messageId:"m1"});const request=sendMail.mock.calls[0][0];expect(request.to).toBe("user@example.com");expect(request.text).toContain("resetToken=a%20b%26c");expect(JSON.stringify(request)).not.toContain("AI_API_KEY");});
});

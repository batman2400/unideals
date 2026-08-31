import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isAllowedStudentEmail } from "../lib/studentEmailDomain";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateImageUpload(file) {
  if (!file) return "Please choose an image.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPEG, PNG, or WEBP image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.`;
  }
  return null;
}

function FileDrop({ label, file, onChange }) {
  return (
    <div>
      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative min-h-[44px]">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-full bg-surface border-2 border-dashed border-outline-variant/30 rounded-xl px-4 py-5 text-center hover:bg-surface-container transition-all">
          <span className="material-symbols-outlined text-primary text-2xl mb-1">cloud_upload</span>
          <p className="text-sm font-bold text-on-background">
            {file ? file.name : `Tap to upload ${label.toLowerCase()}`}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">JPEG, PNG, WEBP (Max 5MB)</p>
        </div>
      </div>
    </div>
  );
}

function StudentVerificationCard({
  user,
  isSchoolStudent,
  onInFlightChange,
  formOpen: formOpenProp,
  onFormOpenChange,
  onSubmitted,
  renewal = false,
  expiresOn,
}) {
  const [internalFormOpen, setInternalFormOpen] = useState(false);
  const formOpen = formOpenProp ?? internalFormOpen;
  const setFormOpen = onFormOpenChange ?? setInternalFormOpen;
  const [path, setPath] = useState(isSchoolStudent ? "manual" : "email_otp");
  const [request, setRequest] = useState(null);
  const [allowedDomains, setAllowedDomains] = useState([]);

  const [verificationStep, setVerificationStep] = useState(1);
  const [uniEmail, setUniEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [emailInstName, setEmailInstName] = useState("");
  const [emailCourse, setEmailCourse] = useState("");
  const [emailStudentId, setEmailStudentId] = useState("");
  const [emailFrontFile, setEmailFrontFile] = useState(null);
  const [emailBackFile, setEmailBackFile] = useState(null);
  const [uniVerifying, setUniVerifying] = useState(false);
  const [uniError, setUniError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [manualInstType, setManualInstType] = useState(isSchoolStudent ? "school" : "university");
  const [manualInstName, setManualInstName] = useState("");
  const [manualCourse, setManualCourse] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualFrontFile, setManualFrontFile] = useState(null);
  const [manualBackFile, setManualBackFile] = useState(null);
  const [manualVerifying, setManualVerifying] = useState(false);
  const [manualError, setManualError] = useState("");

  const inFlight =
    request?.status === "pending" || request?.status === "awaiting_confirmation";
  const isRejected = request?.status === "rejected";

  const refreshRequest = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("manual_verifications")
      .select("id, status, method, reject_reason")
      .eq("user_id", user.id)
      .in("status", ["pending", "awaiting_confirmation", "rejected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    const next = data ?? null;
    setRequest(next);
    onInFlightChange?.(
      next?.status === "pending" || next?.status === "awaiting_confirmation",
    );
    return next;
  };

  async function uploadIdPhoto(file, side) {
    const validationError = validateImageUpload(file);
    if (validationError) throw new Error(validationError);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${side}-${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("verification-documents")
      .upload(filePath, file, { contentType: file.type });
    if (uploadError) throw uploadError;
    return filePath;
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("allowed_domains").select("domain");
      if (active && !error && data) {
        setAllowedDomains(data.map((d) => d.domain.toLowerCase()));
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void refreshRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (isSchoolStudent) setPath("manual");
  }, [isSchoolStudent]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestVerification = async (e) => {
    e?.preventDefault();
    setUniError("");
    const normalized = uniEmail.trim().toLowerCase();
    if (!normalized.includes("@")) {
      setUniError("Please enter a valid email address.");
      return;
    }
    if (!isAllowedStudentEmail(normalized, allowedDomains)) {
      setUniError("Please use your official university or institutional student email address.");
      return;
    }
    if (!emailInstName.trim() || !emailCourse.trim() || !emailStudentId.trim()) {
      setUniError("Institution, course, and student ID are required.");
      return;
    }
    if (!emailFrontFile || !emailBackFile) {
      setUniError("Upload the front and back of your student ID.");
      return;
    }

    setUniVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-verification-otp", {
        body: { email: normalized },
      });
      if (data?.success) {
        setVerificationStep(2);
        setResendCooldown(60);
        return;
      }
      let reason = data?.error;
      if (!reason && error?.context?.json) {
        reason = (await error.context.json().catch(() => null))?.error;
      }
      setUniError(reason || "Failed to send the verification code.");
    } catch (err) {
      setUniError("Couldn't send the verification code. Please try again.");
    } finally {
      setUniVerifying(false);
    }
  };

  const handleConfirmVerification = async (e) => {
    e.preventDefault();
    setUniError("");
    if (otpCode.length !== 6) {
      setUniError("Please enter a valid 6-digit code.");
      return;
    }
    setUniVerifying(true);
    try {
      const [frontPath, backPath] = await Promise.all([
        uploadIdPhoto(emailFrontFile, "front"),
        uploadIdPhoto(emailBackFile, "back"),
      ]);
      const { data, error } = await supabase.rpc("confirm_university_verification", {
        entered_email: uniEmail.trim().toLowerCase(),
        entered_code: otpCode,
        inst_name: emailInstName.trim(),
        course: emailCourse.trim(),
        student_id: emailStudentId.trim(),
        image_url: frontPath,
        image_back_url: backPath,
      });
      if (error) throw error;
      if (data?.success) {
        await refreshRequest();
        onSubmitted?.();
      } else {
        setUniError(data?.error || "Verification failed.");
      }
    } catch (err) {
      setUniError(err.message || "An error occurred.");
    } finally {
      setUniVerifying(false);
    }
  };

  const handleManualVerify = async (e) => {
    e.preventDefault();
    setManualError("");
    if (!manualInstName.trim() || !manualFrontFile || !manualBackFile) {
      setManualError("Institution name and both sides of your student ID are required.");
      return;
    }
    if (manualInstType === "university" && (!manualCourse.trim() || !manualStudentId.trim())) {
      setManualError("Course details and Student ID are required for University verification.");
      return;
    }
    setManualVerifying(true);
    try {
      const [frontPath, backPath] = await Promise.all([
        uploadIdPhoto(manualFrontFile, "front"),
        uploadIdPhoto(manualBackFile, "back"),
      ]);
      const { data, error } = await supabase.rpc("submit_manual_verification", {
        inst_type: manualInstType,
        inst_name: manualInstName.trim(),
        course: manualCourse.trim(),
        student_id: manualStudentId.trim(),
        email: user?.email || "unknown@example.com",
        image_url: frontPath,
        image_back_url: backPath,
      });
      if (error) throw error;
      if (data?.success) {
        await refreshRequest();
        onSubmitted?.();
      } else {
        setManualError(data?.error || "Failed to submit verification request.");
      }
    } catch (err) {
      setManualError(err.message || "An error occurred during submission.");
    } finally {
      setManualVerifying(false);
    }
  };

  const inputClass =
    "w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all";

  return (
    <div className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20">
      <div className="flex items-start gap-3 mb-4">
        <span
          className="material-symbols-outlined text-primary text-2xl mt-0.5"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          school
        </span>
        <div>
          <h3 className="font-headline font-bold text-base text-on-background">
            {renewal ? "Re-verify for this year" : "Get verified"}
          </h3>
          <p className="text-on-surface-variant text-sm mt-1">
            {isSchoolStudent
              ? "School students send both sides of a student ID for admin review. Status is valid for 12 months."
              : "Use a university email so we can confirm your inbox, then an admin checks your ID. Status is valid for 12 months."}
          </p>
        </div>
      </div>

      {inFlight ? (
        <div className="flex items-center gap-3 p-4 bg-[#d4a017]/10 text-[#d4a017] rounded-xl">
          <span className="material-symbols-outlined">pending_actions</span>
          <p className="text-sm font-bold">
            {request?.status === "awaiting_confirmation"
              ? "We confirmed your university inbox. An admin will check both sides of your student ID next."
              : "Both sides of your student ID are with an admin for review."}
          </p>
        </div>
      ) : !formOpen ? (
        <>
          {isRejected ? (
            <div className="mb-4 p-4 bg-error/10 text-error rounded-xl">
              <p className="text-sm font-bold">Your last request was not approved</p>
              <p className="text-sm mt-1">
                {request?.reject_reason || "Please submit a clearer request."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant mb-4">
              {renewal
                ? expiresOn
                  ? `Student status is valid for 12 months. Re-verify by ${expiresOn} to keep deal codes and in-store tickets.`
                  : "Student status is valid for 12 months. Re-verify to keep deal codes and in-store tickets."
                : "Verify your student status to unlock deal codes and in-store tickets. Status is valid for 12 months."}
            </p>
          )}
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="w-full min-h-[44px] px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90"
          >
            {isRejected ? "Resubmit verification" : renewal ? "Re-verify now" : "Get verified"}
          </button>
        </>
      ) : (
        <>
          {isRejected ? (
            <div className="mb-4 p-4 bg-error/10 text-error rounded-xl">
              <p className="text-sm font-bold">Your last request was not approved</p>
              <p className="text-sm mt-1">
                {request?.reject_reason || "Please submit a clearer request."}
              </p>
              <p className="text-xs mt-2">
                Submit again with a clear photo of the front and back of your student ID.
              </p>
            </div>
          ) : null}

          {isSchoolStudent ? null : (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setPath("email_otp")}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold ${
                  path === "email_otp"
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant border border-outline-variant/20"
                }`}
              >
                University email
              </button>
              <button
                type="button"
                onClick={() => setPath("manual")}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold ${
                  path === "manual"
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant border border-outline-variant/20"
                }`}
              >
                Manual / school
              </button>
            </div>
          )}

          {path === "email_otp" && !isSchoolStudent ? (
            <form
              onSubmit={verificationStep === 1 ? handleRequestVerification : handleConfirmVerification}
              className="space-y-4"
            >
              <p className="text-sm text-on-surface-variant">
                We confirm the inbox first, then an admin checks both sides of your student ID.
                You are not verified until an admin approves. Status lasts 12 months.
              </p>
              <input
                type="email"
                placeholder="you@university.ac.lk"
                value={uniEmail}
                onChange={(e) => setUniEmail(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Institution name"
                value={emailInstName}
                onChange={(e) => setEmailInstName(e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Course / faculty"
                  value={emailCourse}
                  onChange={(e) => setEmailCourse(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder="Student ID number"
                  value={emailStudentId}
                  onChange={(e) => setEmailStudentId(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileDrop label="Student ID — front" file={emailFrontFile} onChange={setEmailFrontFile} />
                <FileDrop label="Student ID — back" file={emailBackFile} onChange={setEmailBackFile} />
              </div>
              {verificationStep === 2 ? (
                <>
                  <p className="text-sm text-on-surface-variant">
                    Enter the 6-digit code sent to {uniEmail.trim().toLowerCase()}.
                  </p>
                  <input
                    type="text"
                    placeholder="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    className={`${inputClass} tracking-widest font-mono`}
                  />
                  <button
                    type="button"
                    onClick={handleRequestVerification}
                    disabled={resendCooldown > 0 || uniVerifying}
                    className="text-primary font-bold text-sm hover:underline disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </button>
                </>
              ) : null}
              {uniError ? (
                <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{uniError}</p>
              ) : null}
              <button
                type="submit"
                disabled={uniVerifying}
                className="w-full min-h-[44px] px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-50"
              >
                {uniVerifying
                  ? "Please wait..."
                  : verificationStep === 1
                    ? "Send verification code"
                    : "Confirm code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleManualVerify} className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Upload both sides of your student ID for admin review. You are not verified until
                an admin approves. Status lasts 12 months.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setManualInstType("university")}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold ${
                    manualInstType === "university"
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant border border-outline-variant/20"
                  }`}
                >
                  University
                </button>
                <button
                  type="button"
                  onClick={() => setManualInstType("school")}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold ${
                    manualInstType === "school"
                      ? "bg-primary text-on-primary"
                      : "bg-surface text-on-surface-variant border border-outline-variant/20"
                  }`}
                >
                  School
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="Institution name"
                value={manualInstName}
                onChange={(e) => setManualInstName(e.target.value)}
                className={inputClass}
              />
              {manualInstType === "university" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Course / faculty"
                    value={manualCourse}
                    onChange={(e) => setManualCourse(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    required
                    placeholder="Student ID number"
                    value={manualStudentId}
                    onChange={(e) => setManualStudentId(e.target.value)}
                    className={inputClass}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Grade / year"
                    value={manualCourse}
                    onChange={(e) => setManualCourse(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Student ID (if you have one)"
                    value={manualStudentId}
                    onChange={(e) => setManualStudentId(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
              <input type="email" value={user?.email || ""} readOnly className={inputClass} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileDrop label="Student ID — front" file={manualFrontFile} onChange={setManualFrontFile} />
                <FileDrop label="Student ID — back" file={manualBackFile} onChange={setManualBackFile} />
              </div>
              {manualError ? (
                <p className="text-error text-xs font-bold bg-error/10 p-2.5 rounded-lg">{manualError}</p>
              ) : null}
              <button
                type="submit"
                disabled={manualVerifying}
                className="w-full min-h-[44px] px-6 py-3 bg-primary text-on-primary font-bold text-sm rounded-xl hover:bg-primary/90 disabled:opacity-50"
              >
                {manualVerifying ? "Submitting..." : "Submit for review"}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="text-primary font-bold text-sm hover:underline"
          >
            Not now
          </button>
        </>
      )}
    </div>
  );
}

export default StudentVerificationCard;

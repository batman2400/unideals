import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isAllowedStudentEmail } from "../lib/studentEmailDomain";
import {
  OTHER_UNIVERSITY,
  emailMatchesUniversity,
  findUniversityByEmail,
  mergeUniversityOptions,
} from "../lib/universities";
import {
  SESSION_EXPIRED_MESSAGE,
  explainAuthFailure,
  invokeAuthedFunction,
  promptSignIn,
  requireAccessToken,
} from "../lib/authSession";

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

function showAuthError(setter, message) {
  const text = explainAuthFailure(message);
  setter(text);
  if (text === SESSION_EXPIRED_MESSAGE) {
    promptSignIn();
  }
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

function UniversitySelect({
  universities,
  value,
  onChange,
  otherName,
  onOtherNameChange,
  inputClass,
  id,
}) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="sr-only">
          University
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} appearance-none cursor-pointer`}
        >
          <option value="">Select your university</option>
          {universities.map((uni) => (
            <option key={uni.name} value={uni.name}>
              {uni.name}
            </option>
          ))}
          <option value={OTHER_UNIVERSITY}>Other / not listed</option>
        </select>
      </div>
      {value === OTHER_UNIVERSITY ? (
        <input
          type="text"
          placeholder="University or institute name"
          value={otherName}
          onChange={(e) => onOtherNameChange(e.target.value)}
          className={inputClass}
        />
      ) : null}
    </div>
  );
}

function EmailOtpForm({
  intro,
  selectId,
  universities,
  selectedUni,
  onSelectedUniChange,
  otherUniName,
  onOtherUniNameChange,
  uniEmail,
  onUniEmailChange,
  verificationStep,
  otpCode,
  onOtpCodeChange,
  uniError,
  uniVerifying,
  resendCooldown,
  onRequest,
  onConfirm,
  inputClass,
}) {
  return (
    <form
      onSubmit={verificationStep === 1 ? onRequest : onConfirm}
      className="space-y-4"
    >
      <p className="text-sm text-on-surface-variant">{intro}</p>
      <UniversitySelect
        id={selectId}
        universities={universities}
        value={selectedUni}
        onChange={onSelectedUniChange}
        otherName={otherUniName}
        onOtherNameChange={onOtherUniNameChange}
        inputClass={inputClass}
      />
      <input
        type="email"
        placeholder="you@university.ac.lk"
        value={uniEmail}
        onChange={onUniEmailChange}
        className={inputClass}
      />
      {verificationStep === 2 ? (
        <>
          <p className="text-sm text-on-surface-variant">
            Enter the 6-digit code sent to {uniEmail.trim().toLowerCase()}.
          </p>
          <input
            type="text"
            placeholder="6-digit code"
            value={otpCode}
            onChange={onOtpCodeChange}
            maxLength={6}
            className={`${inputClass} tracking-widest font-mono`}
          />
          <button
            type="button"
            onClick={onRequest}
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
  const [dbUniversities, setDbUniversities] = useState([]);

  const [verificationStep, setVerificationStep] = useState(1);
  const [uniEmail, setUniEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [selectedUni, setSelectedUni] = useState("");
  const [otherUniName, setOtherUniName] = useState("");
  const [uniVerifying, setUniVerifying] = useState(false);
  const [uniError, setUniError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [manualInstType, setManualInstType] = useState(isSchoolStudent ? "school" : "university");
  const [manualInstName, setManualInstName] = useState("");
  const [manualSelectedUni, setManualSelectedUni] = useState("");
  const [manualOtherUniName, setManualOtherUniName] = useState("");
  const [manualCourse, setManualCourse] = useState("");
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualFrontFile, setManualFrontFile] = useState(null);
  const [manualBackFile, setManualBackFile] = useState(null);
  const [manualVerifying, setManualVerifying] = useState(false);
  const [manualError, setManualError] = useState("");

  const universities = useMemo(
    () => mergeUniversityOptions(dbUniversities),
    [dbUniversities],
  );

  const inFlight = request?.status === "pending";
  const isRejected = request?.status === "rejected";

  const chosenUniversityName = () => {
    if (selectedUni === OTHER_UNIVERSITY) return otherUniName.trim();
    return selectedUni.trim();
  };

  const chosenManualUniversityName = () => {
    if (manualInstType === "school") return manualInstName.trim();
    if (manualSelectedUni === OTHER_UNIVERSITY) return manualOtherUniName.trim();
    return manualSelectedUni.trim();
  };

  const refreshRequest = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("manual_verifications")
      .select("id, status, method, reject_reason")
      .eq("user_id", user.id)
      .in("status", ["pending", "rejected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    const next = data ?? null;
    setRequest(next);
    onInFlightChange?.(next?.status === "pending");
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
      const { data, error } = await supabase
        .from("allowed_domains")
        .select("domain, institution_name");
      if (active && !error && data) {
        setAllowedDomains(data.map((d) => d.domain.toLowerCase()));
        setDbUniversities(data);
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

  const applyEmailUniversityMatch = (email) => {
    const match = findUniversityByEmail(email, universities);
    if (match) {
      setSelectedUni(match.name);
      setOtherUniName("");
    }
  };

  const handleRequestVerification = async (e) => {
    e?.preventDefault();
    setUniError("");
    const normalized = uniEmail.trim().toLowerCase();
    const institution = chosenUniversityName();
    if (!institution) {
      setUniError("Please choose your university.");
      return;
    }
    if (!normalized.includes("@")) {
      setUniError("Please enter a valid email address.");
      return;
    }
    if (!isAllowedStudentEmail(normalized, allowedDomains)) {
      setUniError("Please use your official university or institutional student email address.");
      return;
    }
    const selected =
      selectedUni === OTHER_UNIVERSITY
        ? { name: institution, domains: [] }
        : universities.find((uni) => uni.name === selectedUni);
    if (selected && !emailMatchesUniversity(normalized, selected)) {
      const hint = selected.domains?.[0] ? ` Use your @${selected.domains[0]} address.` : "";
      setUniError(`That email does not match ${selected.name}.${hint}`);
      return;
    }

    setUniVerifying(true);
    try {
      const { data, error } = await invokeAuthedFunction("send-verification-otp", {
        email: normalized,
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
      showAuthError(setUniError, reason || "Failed to send the verification code.");
    } catch (err) {
      showAuthError(
        setUniError,
        err?.message || "Couldn't send the verification code. Please try again.",
      );
    } finally {
      setUniVerifying(false);
    }
  };

  const handleConfirmVerification = async (e) => {
    e.preventDefault();
    setUniError("");
    const institution = chosenUniversityName();
    if (!institution) {
      setUniError("Please choose your university.");
      return;
    }
    if (otpCode.length !== 6) {
      setUniError("Please enter a valid 6-digit code.");
      return;
    }
    setUniVerifying(true);
    try {
      await requireAccessToken();
      const { data, error } = await supabase.rpc("confirm_university_verification", {
        entered_email: uniEmail.trim().toLowerCase(),
        entered_code: otpCode,
        inst_name: institution,
        course: null,
        student_id: null,
        image_url: null,
        image_back_url: null,
      });
      if (error) throw error;
      if (data?.success) {
        await refreshRequest();
        onSubmitted?.();
      } else {
        showAuthError(setUniError, data?.error || "Verification failed.");
      }
    } catch (err) {
      showAuthError(setUniError, err.message || "An error occurred.");
    } finally {
      setUniVerifying(false);
    }
  };

  const handleManualVerify = async (e) => {
    e.preventDefault();
    setManualError("");
    const institution = chosenManualUniversityName();
    if (!institution || !manualFrontFile || !manualBackFile) {
      setManualError("Institution name and both sides of your student ID are required.");
      return;
    }
    if (manualInstType === "university" && (!manualCourse.trim() || !manualStudentId.trim())) {
      setManualError("Course details and Student ID are required for University verification.");
      return;
    }
    setManualVerifying(true);
    try {
      await requireAccessToken();
      const [frontPath, backPath] = await Promise.all([
        uploadIdPhoto(manualFrontFile, "front"),
        uploadIdPhoto(manualBackFile, "back"),
      ]);
      const { data, error } = await supabase.rpc("submit_manual_verification", {
        inst_type: manualInstType,
        inst_name: institution,
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
        showAuthError(
          setManualError,
          data?.error || "Failed to submit verification request.",
        );
      }
    } catch (err) {
      showAuthError(
        setManualError,
        err.message || "An error occurred during submission.",
      );
    } finally {
      setManualVerifying(false);
    }
  };

  const inputClass =
    "w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[44px] text-sm text-on-background focus:outline-none focus:border-primary transition-all";

  return (
    <div
      data-clarity-mask="true"
      className="w-full bg-gray-50 rounded-2xl p-6 shadow-sm border border-outline-variant/20"
    >
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
              : "A correct code sent to your university email verifies you immediately. Upload a student ID only if you do not have an institute email."}
          </p>
        </div>
      </div>

      {inFlight ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-[#d4a017]/10 text-[#d4a017] rounded-xl">
            <span className="material-symbols-outlined">pending_actions</span>
            <p className="text-sm font-bold">
              Both sides of your student ID are with an admin for review.
            </p>
          </div>
          {isSchoolStudent ? null : (
            <EmailOtpForm
              intro="Have a university email? Choose your university and enter the code we send to verify immediately without waiting for ID review."
              selectId="pending-verification-university"
              universities={universities}
              selectedUni={selectedUni}
              onSelectedUniChange={setSelectedUni}
              otherUniName={otherUniName}
              onOtherUniNameChange={setOtherUniName}
              uniEmail={uniEmail}
              onUniEmailChange={(e) => {
                const next = e.target.value;
                setUniEmail(next);
                applyEmailUniversityMatch(next);
              }}
              verificationStep={verificationStep}
              otpCode={otpCode}
              onOtpCodeChange={(e) => setOtpCode(e.target.value)}
              uniError={uniError}
              uniVerifying={uniVerifying}
              resendCooldown={resendCooldown}
              onRequest={handleRequestVerification}
              onConfirm={handleConfirmVerification}
              inputClass={inputClass}
            />
          )}
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
                Use your university email if you have one, or submit again with a clear photo of
                the front and back of your student ID.
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
            <EmailOtpForm
              intro="Choose your university, then enter the 6-digit code we send. A correct code verifies you straight away. Status lasts 12 months."
              selectId="verification-university"
              universities={universities}
              selectedUni={selectedUni}
              onSelectedUniChange={setSelectedUni}
              otherUniName={otherUniName}
              onOtherUniNameChange={setOtherUniName}
              uniEmail={uniEmail}
              onUniEmailChange={(e) => {
                const next = e.target.value;
                setUniEmail(next);
                applyEmailUniversityMatch(next);
              }}
              verificationStep={verificationStep}
              otpCode={otpCode}
              onOtpCodeChange={(e) => setOtpCode(e.target.value)}
              uniError={uniError}
              uniVerifying={uniVerifying}
              resendCooldown={resendCooldown}
              onRequest={handleRequestVerification}
              onConfirm={handleConfirmVerification}
              inputClass={inputClass}
            />
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
              {manualInstType === "university" ? (
                <UniversitySelect
                  id="manual-verification-university"
                  universities={universities}
                  value={manualSelectedUni}
                  onChange={setManualSelectedUni}
                  otherName={manualOtherUniName}
                  onOtherNameChange={setManualOtherUniName}
                  inputClass={inputClass}
                />
              ) : (
                <input
                  type="text"
                  required
                  placeholder="School name"
                  value={manualInstName}
                  onChange={(e) => setManualInstName(e.target.value)}
                  className={inputClass}
                />
              )}
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

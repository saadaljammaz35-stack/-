import type { Namespace } from "../types";

export default {
  ar: {
    title: "الفريق",
    description: "أعضاء فريق العيادة وأدوارهم، ودعوة أعضاء جدد.",
    inviteButton: "دعوة عضو",
    // Seats
    seatsLabel: "مقاعد الفريق",
    seatsValue: "{used} من {limit}",
    seatsHint: "كل عضو في الفريق يشغل مقعداً واحداً، ويحدد اشتراكك عدد المقاعد.",
    seatsNoPlan:
      "لا يوجد اشتراك مسجّل لهذه العيادة، لذلك لا يُعرف حد المقاعد. تواصل مع فريق CliniBot.",
    seatsFull:
      "استُخدمت كل المقاعد في باقتك الحالية. لإضافة عضو جديد أزل عضواً أو انتقل إلى باقة أكبر.",
    seatsError: "تعذّر تحميل عدد المقاعد. ما زال بإمكانك الاطلاع على الفريق.",
    viewPlans: "عرض الباقات",
    // Notices by role
    noticeReceptionist:
      "يمكنك الاطلاع على أعضاء الفريق. دعوة الأعضاء وإزالتهم وتغيير أدوارهم متاحة لمالك العيادة ومديريها فقط.",
    noticeAdmin:
      "بصفتك مديراً يمكنك دعوة موظفي الاستقبال وإزالتهم. دعوة المديرين وتغيير الأدوار متاحة للمالك فقط.",
    // List
    membersTitle: "أعضاء الفريق",
    membersCount: "عدد الأعضاء: {count}",
    membersCaption: "أعضاء فريق العيادة",
    you: "أنت",
    joined: "انضم في {date}",
    actionsFor: "إجراءات {name}",
    changeRole: "تغيير الدور",
    remove: "إزالة",
    leave: "مغادرة العيادة",
    lastOwnerNote:
      "المالك الوحيد للعيادة، فلا يمكن إزالته أو تغيير دوره. لتغيير ذلك اجعل عضواً آخر مالكاً أولاً.",
    emptyTitle: "لا يوجد أعضاء لعرضهم",
    emptyText: "أعد تحميل الصفحة. إذا استمرت المشكلة تواصل مع الدعم.",
    // Invite dialog
    inviteTitle: "دعوة عضو إلى الفريق",
    inviteDescription:
      "إذا كان لدى الشخص حساب في CliniBot يُضاف إلى الفريق مباشرة، وإلا نرسل إليه رسالة دعوة على بريده الإلكتروني.",
    nameLabel: "الاسم",
    nameHint: "يظهر لبقية الفريق في القوائم وسجل النشاط.",
    nameTooLong: "الاسم طويل جداً (120 حرفاً كحد أقصى).",
    emailLabel: "البريد الإلكتروني",
    emailRequired: "أدخل البريد الإلكتروني.",
    emailInvalid: "أدخل بريداً إلكترونياً صحيحاً، مثل name@clinic.sa",
    roleLabel: "الدور",
    roleOwnerHint: "صلاحيات كاملة، منها تغيير الأدوار وحذف العيادة.",
    roleAdminHint: "يدير معلومات العيادة والمساعد وواتساب والإعدادات وموظفي الاستقبال.",
    roleReceptionistHint:
      "يتابع المحادثات وطلبات المواعيد، ويطّلع على معلومات العيادة دون تعديلها.",
    inviteAdminLimit: "بصفتك مديراً يمكنك دعوة موظفي الاستقبال فقط.",
    sendInvite: "إرسال الدعوة",
    invitedEmailSent:
      "أرسلنا رسالة دعوة إلى {email} وأضفناه إلى الفريق. يستطيع الدخول بعد قبول الدعوة من بريده.",
    invitedExisting:
      "لدى {email} حساب في CliniBot، فأضفناه إلى الفريق مباشرة. سيجد العيادة في حسابه عند دخوله.",
    seatLimitTitle: "لا توجد مقاعد متاحة",
    // Role change
    roleDialogTitle: "تغيير دور {name}",
    roleDialogDescription: "الدور الحالي: {role}. يُطبَّق الدور الجديد فوراً.",
    newRoleLabel: "الدور الجديد",
    promoteOwnerNote:
      "سيحصل المالك على كل الصلاحيات، ومنها تغيير الأدوار (بما فيها دورك) وحذف العيادة نهائياً.",
    selfChangeWarning:
      "أنت على وشك تغيير دورك أنت. ستفقد صلاحيات المالك في هذه العيادة فوراً، ولا يستعيدها لك إلا مالك آخر.",
    selfChangeConfirm: "أفهم أنني سأفقد صلاحيات المالك في هذه العيادة",
    saveRole: "حفظ الدور",
    roleChanged: "أصبح دور {name}: {role}.",
    // Remove / leave
    removeTitle: "إزالة {name} من الفريق؟",
    removeDescription:
      "سيفقد الوصول إلى هذه العيادة فوراً. لا يُحذف حسابه في CliniBot، ويمكن دعوته مجدداً لاحقاً.",
    removeConfirm: "إزالة من الفريق",
    removed: "أُزيل {name} من الفريق.",
    leaveTitle: "مغادرة {clinic}؟",
    leaveDescription:
      "ستفقد الوصول إلى محادثات هذه العيادة ومواعيدها وإعداداتها فوراً. للعودة يجب أن يدعوك مالك العيادة أو أحد مديريها من جديد.",
    leaveConfirm: "مغادرة العيادة",
    left: "غادرت {clinic}.",
    // Roles table
    rolesTitle: "ماذا يستطيع كل دور؟",
    rolesDescription: "تُطبَّق هذه الصلاحيات على الخادم أيضاً، وليس في الواجهة فقط.",
    rolesCaption: "صلاحيات الأدوار في العيادة",
    capability: "الصلاحية",
    allowed: "مسموح",
    notAllowed: "غير مسموح",
    cap_conversations: "متابعة المحادثات وطلبات المواعيد",
    cap_knowledgeView: "الاطلاع على معلومات العيادة (الخدمات والأسئلة الشائعة)",
    cap_knowledgeEdit: "تعديل معلومات العيادة",
    cap_assistant: "إعداد المساعد الذكي وربط واتساب",
    cap_settings: "تعديل إعدادات العيادة",
    cap_staffReceptionists: "دعوة موظفي الاستقبال وإزالتهم",
    cap_audit: "الاطلاع على سجل النشاط",
    cap_billing: "الاطلاع على الباقة والاستخدام",
    cap_staffRoles: "دعوة المديرين وتغيير الأدوار",
    cap_deleteClinic: "حذف العيادة نهائياً",
  },
  en: {
    title: "Team",
    description: "Your clinic's team members and their roles, and inviting new people.",
    inviteButton: "Invite member",
    // Seats
    seatsLabel: "Team seats",
    seatsValue: "{used} of {limit}",
    seatsHint: "Each team member uses one seat; your plan sets how many seats you have.",
    seatsNoPlan:
      "This clinic has no subscription on record, so its seat limit is unknown. Contact the CliniBot team.",
    seatsFull:
      "All seats on your current plan are in use. To add someone, remove a member or move to a bigger plan.",
    seatsError: "We couldn't load the seat count. You can still see the team.",
    viewPlans: "See plans",
    // Notices by role
    noticeReceptionist:
      "You can see the team. Only the clinic's owners and admins can invite or remove members or change roles.",
    noticeAdmin:
      "As an admin you can invite and remove receptionists. Only owners can invite admins or change roles.",
    // List
    membersTitle: "Team members",
    membersCount: "Members: {count}",
    membersCaption: "Clinic team members",
    you: "You",
    joined: "Joined {date}",
    actionsFor: "Actions for {name}",
    changeRole: "Change role",
    remove: "Remove",
    leave: "Leave clinic",
    lastOwnerNote:
      "The clinic's only owner can't be removed or have their role changed. Make another member an owner first.",
    emptyTitle: "No members to show",
    emptyText: "Reload the page. If this keeps happening, contact support.",
    // Invite dialog
    inviteTitle: "Invite a team member",
    inviteDescription:
      "If the person already has a CliniBot account they're added straight away; otherwise we email them an invitation.",
    nameLabel: "Name",
    nameHint: "Shown to the rest of the team in lists and the audit log.",
    nameTooLong: "That name is too long (120 characters at most).",
    emailLabel: "Email",
    emailRequired: "Enter the email address.",
    emailInvalid: "Enter a valid email address, like name@clinic.sa",
    roleLabel: "Role",
    roleOwnerHint: "Full access, including changing roles and deleting the clinic.",
    roleAdminHint: "Manages clinic knowledge, the assistant, WhatsApp, settings and receptionists.",
    roleReceptionistHint:
      "Handles conversations and appointment requests, and can read clinic knowledge without editing it.",
    inviteAdminLimit: "As an admin you can invite receptionists only.",
    sendInvite: "Send invitation",
    invitedEmailSent:
      "We emailed an invitation to {email} and added them to the team. They can sign in after accepting it.",
    invitedExisting:
      "{email} already has a CliniBot account, so we added them to the team. They'll see the clinic next time they sign in.",
    seatLimitTitle: "No seats available",
    // Role change
    roleDialogTitle: "Change {name}'s role",
    roleDialogDescription: "Current role: {role}. The new role applies immediately.",
    newRoleLabel: "New role",
    promoteOwnerNote:
      "Owners have every permission, including changing roles (yours too) and permanently deleting the clinic.",
    selfChangeWarning:
      "You're about to change your own role. You'll lose owner access to this clinic right away, and only another owner can give it back.",
    selfChangeConfirm: "I understand I'll lose owner access to this clinic",
    saveRole: "Save role",
    roleChanged: "{name} is now: {role}.",
    // Remove / leave
    removeTitle: "Remove {name} from the team?",
    removeDescription:
      "They lose access to this clinic right away. Their CliniBot account isn't deleted, and you can invite them again later.",
    removeConfirm: "Remove from team",
    removed: "{name} was removed from the team.",
    leaveTitle: "Leave {clinic}?",
    leaveDescription:
      "You'll lose access to this clinic's conversations, appointments and settings right away. To come back, an owner or admin has to invite you again.",
    leaveConfirm: "Leave clinic",
    left: "You left {clinic}.",
    // Roles table
    rolesTitle: "What each role can do",
    rolesDescription: "These permissions are enforced by the server too, not just the interface.",
    rolesCaption: "Role permissions in the clinic",
    capability: "Permission",
    allowed: "Allowed",
    notAllowed: "Not allowed",
    cap_conversations: "Handle conversations and appointment requests",
    cap_knowledgeView: "Read clinic knowledge (services and FAQs)",
    cap_knowledgeEdit: "Edit clinic knowledge",
    cap_assistant: "Set up the AI assistant and WhatsApp",
    cap_settings: "Edit clinic settings",
    cap_staffReceptionists: "Invite and remove receptionists",
    cap_audit: "View the audit log",
    cap_billing: "View plan and usage",
    cap_staffRoles: "Invite admins and change roles",
    cap_deleteClinic: "Permanently delete the clinic",
  },
} satisfies Namespace;

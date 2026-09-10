/* Design system: «Конструкторская станция» — единая проверка Supabase Auth для закрытых учительских страниц. */
(function () {
  function toLogin(reason) {
    const current = `${window.location.pathname.split('/').pop() || 'teacher.html'}${window.location.search}${window.location.hash}`;
    const target = `teacher-login.html?next=${encodeURIComponent(current)}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;
    window.location.replace(target);
  }

  async function protectTeacherPage() {
    const body = document.body;
    if (!body || body.dataset.teacherAuth !== 'required') return;
    if (!window.supabase || !window.ROBO_SUPABASE) {
      toLogin('config');
      return;
    }

    const client = window.supabase.createClient(window.ROBO_SUPABASE.url, window.ROBO_SUPABASE.publishableKey);
    window.roboTeacherClient = client;
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        toLogin('required');
        return;
      }
      const { data: userData, error } = await client.auth.getUser();
      const email = userData?.user?.email?.trim().toLowerCase();
      const adminEmail = window.ROBO_SUPABASE.adminEmail.trim().toLowerCase();
      if (error || !email || email !== adminEmail) {
        await client.auth.signOut();
        toLogin('forbidden');
        return;
      }
      document.querySelectorAll('[data-teacher-email]').forEach((node) => { node.textContent = email; });
      document.querySelectorAll('[data-auth-signout]').forEach((button) => {
        button.addEventListener('click', async () => {
          await client.auth.signOut();
          toLogin('signedout');
        });
      });
      body.classList.remove('auth-pending');
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) toLogin('signedout');
      });
    } catch (error) {
      toLogin('error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', protectTeacherPage);
  else protectTeacherPage();
})();
